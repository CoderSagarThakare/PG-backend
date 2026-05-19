const mongoose = require("mongoose");
const { RentPayment, Bed } = require("../models");
const ApiError = require("../utils/ApiError");
const httpStatus = require("http-status");


/**
 * Create or upsert a rent payment record for a given tenant/bed/month.
 */
const recordPayment = async (data, recordedBy) => {
  const { bedId, userId, rentMonth, amount, amountPaid, paymentMode, paidDate, referenceNo, notes } = data;

  // Validate the bed belongs to this PG and is occupied by this user
  const bed = await Bed.findById(bedId).populate("roomId").populate("pgId");
  if (!bed || bed.isDeleted) throw new ApiError(httpStatus.NOT_FOUND, "Bed not found");
  if (String(bed.userId) !== String(userId)) throw new ApiError(httpStatus.BAD_REQUEST, "User is not assigned to this bed");

  const paid = amountPaid ?? amount;
  let status = "pending";
  if (paid >= amount) status = "paid";
  else if (paid > 0) status = "partial";

  // Upsert — update if record for this bed/user/month already exists
  const rent = await RentPayment.findOneAndUpdate(
    { bedId, userId, rentMonth },
    {
      $set: {
        bedId, userId, rentMonth,
        roomId: bed.roomId._id,
        pgId: bed.pgId._id,
        amount,
        amountPaid: paid,
        status,
        paymentMode: paymentMode || null,
        paidDate: paidDate || (paid > 0 ? new Date() : null),
        referenceNo: referenceNo || null,
        notes: notes || null,
        recordedBy,
      },
    },
    { upsert: true, new: true }
  ).populate("userId", "name email mobNo1")
   .populate("bedId", "bedNumber price")
   .populate("roomId", "roomNumber floor")
   .populate("pgId", "name");

  return rent;
};

/**
 * Get paginated rent records with filters.
 */
const getRentPayments = async ({ pgId, userId, rentMonth, status, paymentMode, page = 1, limit = 20 }) => {
  const filter = { isDeleted: false };
  if (pgId) filter.pgId = pgId;
  if (userId) filter.userId = userId;
  if (rentMonth) filter.rentMonth = rentMonth;
  if (status) filter.status = status;
  if (paymentMode) filter.paymentMode = paymentMode;

  const skip = (page - 1) * limit;
  const [records, total] = await Promise.all([
    RentPayment.find(filter)
      .populate("userId", "name email mobNo1")
      .populate("bedId", "bedNumber price")
      .populate("roomId", "roomNumber floor")
      .populate("pgId", "name")
      .populate("recordedBy", "name")
      .sort({ rentMonth: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    RentPayment.countDocuments(filter),
  ]);

  return { records, total, page: Number(page), limit: Number(limit) };
};

/**
 * Monthly summary stats for a given PG and month.
 */
const getMonthlySummary = async (pgId, rentMonth) => {
  const filter = { isDeleted: false };
  if (pgId) {
    if (mongoose.Types.ObjectId.isValid(pgId)) {
      filter.pgId = new mongoose.Types.ObjectId(pgId);
    } else {
      filter.pgId = pgId;
    }
  }
  if (rentMonth) filter.rentMonth = rentMonth;

  const stats = await RentPayment.aggregate([
    { $match: filter },

    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalDue: { $sum: "$amount" },
        totalPaid: { $sum: "$amountPaid" },
      },
    },
  ]);

  const summary = { paid: 0, pending: 0, partial: 0, overdue: 0, under_review: 0, totalDue: 0, totalCollected: 0, tenantCount: 0 };
  stats.forEach(({ _id, count, totalDue, totalPaid }) => {
    summary[_id] = count;
    summary.totalDue += totalDue;
    if (_id === "paid" || _id === "partial") {
      summary.totalCollected += totalPaid;
    }
    summary.tenantCount += count;
  });
  summary.collectionRate = summary.tenantCount > 0
    ? Math.round(((summary.paid || 0) / summary.tenantCount) * 100)
    : 0;

  return summary;
};

/**
 * Update a single rent payment (partial to full, add reference, etc.)
 */
const updatePayment = async (rentId, updates, pgId) => {
  const query = { _id: rentId, isDeleted: false };
  if (pgId && mongoose.Types.ObjectId.isValid(pgId)) query.pgId = pgId;

  const rent = await RentPayment.findOne(query);
  if (!rent) throw new ApiError(httpStatus.NOT_FOUND, "Rent record not found");

  const paid = updates.amountPaid ?? rent.amountPaid;
  const due = updates.amount ?? rent.amount;
  let status = rent.status;
  if (paid >= due) status = "paid";
  else if (paid > 0) status = "partial";
  else status = "pending";

  Object.assign(rent, { ...updates, status });
  if (paid > 0 && !rent.paidDate) rent.paidDate = new Date();
  await rent.save();

  return rent.populate(["userId", "bedId", "roomId", "pgId"]);
};

/**
 * Soft-delete a rent record.
 */
const deletePayment = async (rentId, pgId) => {
  const query = { _id: rentId, isDeleted: false };
  if (pgId && mongoose.Types.ObjectId.isValid(pgId)) query.pgId = pgId;

  const rent = await RentPayment.findOne(query);
  if (!rent) throw new ApiError(httpStatus.NOT_FOUND, "Rent record not found");
  rent.isDeleted = true;
  await rent.save();
};


/**
 * Auto-generate pending rent records for all occupied beds in a PG for a given month.
 * Useful for bulk rent generation at month start.
 */
const generateMonthlyRent = async (pgId, rentMonth, recordedBy) => {
  const beds = await Bed.find({ pgId, status: "occupied", isDeleted: false }).populate("roomId");
  const results = { created: 0, skipped: 0 };

  const [yearStr, monthStr] = rentMonth.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  const totalDaysInMonth = new Date(year, month, 0).getDate();
  const lastDateOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

  await Promise.all(beds.map(async (bed) => {
    const exists = await RentPayment.exists({ bedId: bed._id, userId: bed.userId, rentMonth });
    if (exists) { results.skipped++; return; }

    let rentAmount = bed.price;
    let rentNotes = null;

    if (bed.assignedAt) {
      const assignYear = bed.assignedAt.getFullYear();
      const assignMonth = bed.assignedAt.getMonth() + 1;

      if (assignYear === year && assignMonth === month) {
        const startDay = bed.assignedAt.getDate();
        const activeDays = (totalDaysInMonth - startDay) + 1;
        rentAmount = Math.round((activeDays / totalDaysInMonth) * bed.price);
        const formattedDate = bed.assignedAt.toISOString().slice(0, 10);
        rentNotes = `Prorated rent: ${activeDays} active days (joined on ${formattedDate})`;
      } else if (bed.assignedAt > lastDateOfMonth) {
        results.skipped++;
        return;
      }
    }

    await RentPayment.create({
      bedId: bed._id,
      userId: bed.userId,
      roomId: bed.roomId._id,
      pgId,
      rentMonth,
      amount: rentAmount,
      amountPaid: 0,
      status: "pending",
      notes: rentNotes,
      recordedBy,
    });
    results.created++;
  }));

  return results;
};

/**
 * Student submits payment proof (scanned QR/made payment online)
 */
const submitPaymentProof = async (userId, rentId, data) => {
  const rent = await RentPayment.findOne({ _id: rentId, userId, isDeleted: false });
  if (!rent) throw new ApiError(httpStatus.NOT_FOUND, "Rent record not found for this tenant");
  
  if (rent.status === "paid") {
    throw new ApiError(httpStatus.BAD_REQUEST, "This rent is already marked as paid");
  }

  const { paymentMode, referenceNo, notes, amountPaid } = data;
  
  rent.paymentMode = paymentMode;
  rent.referenceNo = referenceNo;
  rent.notes = notes;
  rent.amountPaid = amountPaid || rent.amount; // default to full bed price
  rent.status = "under_review";
  rent.paidDate = new Date(); // date when transaction took place

  await rent.save();
  return rent.populate(["bedId", "roomId", "pgId"]);
};

/**
 * Owner/Manager approves a payment proof
 */
const approvePayment = async (rentId, recordedBy, pgId) => {
  const query = { _id: rentId, isDeleted: false };
  if (pgId && mongoose.Types.ObjectId.isValid(pgId)) query.pgId = pgId;

  const rent = await RentPayment.findOne(query);
  if (!rent) throw new ApiError(httpStatus.NOT_FOUND, "Rent record not found");

  const paid = rent.amountPaid || rent.amount;
  const status = paid >= rent.amount ? "paid" : "partial";

  rent.status = status;
  rent.amountPaid = paid;
  rent.recordedBy = recordedBy;
  if (!rent.paidDate) rent.paidDate = new Date();

  await rent.save();
  return rent.populate(["userId", "bedId", "roomId", "pgId"]);
};

/**
 * Owner/Manager rejects a payment proof (resets back to pending)
 */
const rejectPayment = async (rentId, pgId, rejectionNotes) => {
  const query = { _id: rentId, isDeleted: false };
  if (pgId && mongoose.Types.ObjectId.isValid(pgId)) query.pgId = pgId;

  const rent = await RentPayment.findOne(query);
  if (!rent) throw new ApiError(httpStatus.NOT_FOUND, "Rent record not found");


  rent.status = "pending";
  rent.notes = rejectionNotes ? `Rejection reason: ${rejectionNotes}` : "Payment proof rejected by owner";
  rent.paymentMode = null;
  rent.referenceNo = null;
  rent.amountPaid = 0;
  rent.paidDate = null;

  await rent.save();
  return rent.populate(["userId", "bedId", "roomId", "pgId"]);
};

/**
 * Owner/Manager bulk approves multiple payment proofs at once
 */
const bulkApprovePayments = async (rentIds, recordedBy, pgId) => {
  const results = { approved: 0, failed: 0 };
  
  await Promise.all(rentIds.map(async (id) => {
    try {
      await approvePayment(id, recordedBy, pgId);
      results.approved++;
    } catch {
      results.failed++;
    }
  }));

  return results;
};

module.exports = {
  recordPayment,
  getRentPayments,
  getMonthlySummary,
  updatePayment,
  deletePayment,
  generateMonthlyRent,
  submitPaymentProof,
  approvePayment,
  rejectPayment,
  bulkApprovePayments,
};

