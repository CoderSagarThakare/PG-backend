const mongoose = require("mongoose");
const { RentPayment, Bed, PG } = require("../models");
const ApiError = require("../utils/ApiError");
const httpStatus = require("http-status");

/**
 * Helper to validate and clean mongoose ObjectId
 */
const validateAndGetCleanId = (id, fieldName = "record") => {
  if (typeof id === "string") {
    id = id.trim();
  }
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(httpStatus.NOT_FOUND, `${fieldName} not found`);
  }
  return id;
};

/**
 * Dynamic checker to scan pending/partial rent bills and transition them to overdue + apply penalties
 */
const checkAndApplyOverduePayments = async (pgIdOrIds) => {
  if (!pgIdOrIds) return;

  let pgIds = [];
  if (Array.isArray(pgIdOrIds)) {
    pgIds = pgIdOrIds;
  } else if (pgIdOrIds && pgIdOrIds.$in && Array.isArray(pgIdOrIds.$in)) {
    pgIds = pgIdOrIds.$in;
  } else {
    pgIds = [pgIdOrIds];
  }

  pgIds = pgIds.filter(id => mongoose.Types.ObjectId.isValid(id));
  if (pgIds.length === 0) return;

  const pgs = await PG.find({ _id: { $in: pgIds }, isDeleted: false });
  const pgMap = new Map(pgs.map(p => [String(p._id), p]));

  const unpaidRents = await RentPayment.find({
    pgId: { $in: pgIds },
    status: { $in: ["pending", "partial"] },
    isDeleted: false,
  }).populate("bedId");

  if (unpaidRents.length === 0) return;

  const now = new Date();

  for (const rent of unpaidRents) {
    const pg = pgMap.get(String(rent.pgId));
    if (!pg) continue;

    // Check if user joined mid-month for this bill's month
    const bed = rent.bedId;
    if (bed && bed.assignedAt) {
      const [rentYear, rentMonthNum] = rent.rentMonth.split("-").map(Number);
      const assignYear = bed.assignedAt.getFullYear();
      const assignMonth = bed.assignedAt.getMonth() + 1;
      const assignDay = bed.assignedAt.getDate();

      // If they joined mid-month (day > 1) in this exact rentMonth, skip overdue check
      if (assignYear === rentYear && assignMonth === rentMonthNum && assignDay > 1) {
        continue;
      }
    }

    const dueDay = pg.dueDayOfMonth || 10;
    const lateFee = pg.lateFee || 0;

    const [rentYear, rentMonth] = rent.rentMonth.split("-").map(Number);
    const dueDate = new Date(rentYear, rentMonth - 1, dueDay, 23, 59, 59, 999);

    if (now > dueDate) {
      rent.status = "overdue";
      if (!rent.isPenaltyApplied && lateFee > 0) {
        rent.penaltyAmount = lateFee;
        rent.isPenaltyApplied = true;
      }
      await rent.save();
    }
  }
};


/**
 * Create or upsert a rent payment record for a given tenant/bed/month.
 */
const recordPayment = async (data, recordedBy) => {
  const { bedId, userId, rentMonth, amount, amountPaid, paymentMode, paidDate, referenceNo, notes, activeDays, status: inputStatus } = data;

  // Validate the bed belongs to this PG and is occupied by this user
  const bed = await Bed.findById(bedId).populate("roomId").populate("pgId");
  if (!bed || bed.isDeleted) throw new ApiError(httpStatus.NOT_FOUND, "Bed not found");
  if (String(bed.userId) !== String(userId)) throw new ApiError(httpStatus.BAD_REQUEST, "User is not assigned to this bed");

  const initialPaid = amountPaid ?? amount;
  let status = inputStatus;
  if (!status) {
    status = "pending";
    if (initialPaid >= amount) status = "paid";
    else if (initialPaid > 0) status = "partial";
  }

  const isPendingOrOverdue = status === "pending" || status === "overdue";
  const paid = isPendingOrOverdue ? 0 : (amountPaid ?? amount);
  const paymentModeVal = isPendingOrOverdue ? null : (paymentMode || null);
  const paidDateVal = isPendingOrOverdue ? null : (paidDate || (paid > 0 ? new Date() : null));
  const referenceNoVal = isPendingOrOverdue ? null : (referenceNo || null);

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
        paymentMode: paymentModeVal,
        paidDate: paidDateVal,
        referenceNo: referenceNoVal,
        notes: notes || null,
        recordedBy,
        activeDays: activeDays || null,
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
  if (pgId) {
    await checkAndApplyOverduePayments(pgId);
  } else if (userId) {
    const studentUnpaid = await RentPayment.find({
      userId,
      status: { $in: ["pending", "partial"] },
      isDeleted: false
    }, "pgId");
    const studentPgIds = [...new Set(studentUnpaid.map(r => String(r.pgId)))];
    await checkAndApplyOverduePayments(studentPgIds);
  }

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
  if (pgId) {
    await checkAndApplyOverduePayments(pgId);
  }

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
  rentId = validateAndGetCleanId(rentId, "Rent record");
  if (pgId && typeof pgId === "string") pgId = pgId.trim();

  const query = { _id: rentId, isDeleted: false };
  if (pgId && mongoose.Types.ObjectId.isValid(pgId)) query.pgId = pgId;

  const rent = await RentPayment.findOne(query);
  if (!rent) throw new ApiError(httpStatus.NOT_FOUND, "Rent record not found");

  const paid = updates.amountPaid ?? rent.amountPaid;
  const baseDue = updates.amount ?? rent.amount;
  const penalty = rent.penaltyAmount || 0;
  const totalDue = baseDue + penalty;
  let status = rent.status;
  if (paid >= totalDue) status = "paid";
  else if (paid > 0) status = "partial";
  else status = rent.isPenaltyApplied ? "overdue" : "pending";

  Object.assign(rent, { ...updates, status });
  if (paid > 0 && !rent.paidDate) rent.paidDate = new Date();
  await rent.save();

  return rent.populate(["userId", "bedId", "roomId", "pgId"]);
};

/**
 * Soft-delete a rent record.
 */
const deletePayment = async (rentId, pgId) => {
  rentId = validateAndGetCleanId(rentId, "Rent record");
  if (pgId && typeof pgId === "string") pgId = pgId.trim();

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
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (rentMonth > currentMonthStr) {
    throw new ApiError(httpStatus.BAD_REQUEST, "You cannot generate rent bills for future months");
  }

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
    let computedActiveDays = totalDaysInMonth;

    if (bed.assignedAt) {
      const assignYear = bed.assignedAt.getFullYear();
      const assignMonth = bed.assignedAt.getMonth() + 1;

      if (assignYear === year && assignMonth === month) {
        const startDay = bed.assignedAt.getDate();
        computedActiveDays = (totalDaysInMonth - startDay) + 1;
        rentAmount = Math.round((computedActiveDays / totalDaysInMonth) * bed.price);
        const formattedDate = bed.assignedAt.toISOString().slice(0, 10);
        rentNotes = `Prorated rent: ${computedActiveDays} active days (joined on ${formattedDate})`;
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
      activeDays: computedActiveDays,
    });
    results.created++;
  }));

  return results;
};

/**
 * Student submits payment proof (scanned QR/made payment online)
 */
const submitPaymentProof = async (userId, rentId, data) => {
  userId = validateAndGetCleanId(userId, "User");
  rentId = validateAndGetCleanId(rentId, "Rent record");

  const rent = await RentPayment.findOne({ _id: rentId, userId, isDeleted: false });
  if (!rent) throw new ApiError(httpStatus.NOT_FOUND, "Rent record not found for this tenant");
  
  if (rent.status === "paid") {
    throw new ApiError(httpStatus.BAD_REQUEST, "This rent is already marked as paid");
  }

  const { paymentMode, referenceNo, notes, amountPaid } = data;
  
  rent.paymentMode = paymentMode;
  rent.referenceNo = referenceNo;
  rent.notes = notes;
  rent.amountPaid = amountPaid || (rent.amount + (rent.penaltyAmount || 0)); // default to full price + penalty
  rent.status = "under_review";
  rent.paidDate = new Date(); // date when transaction took place

  await rent.save();
  return rent.populate(["bedId", "roomId", "pgId"]);
};

/**
 * Owner/Manager approves a payment proof
 */
const approvePayment = async (rentId, recordedBy, pgId) => {
  rentId = validateAndGetCleanId(rentId, "Rent record");
  recordedBy = validateAndGetCleanId(recordedBy, "User");
  if (pgId && typeof pgId === "string") pgId = pgId.trim();

  const query = { _id: rentId, isDeleted: false };
  if (pgId && mongoose.Types.ObjectId.isValid(pgId)) query.pgId = pgId;

  const rent = await RentPayment.findOne(query);
  if (!rent) throw new ApiError(httpStatus.NOT_FOUND, "Rent record not found");

  const totalDue = rent.amount + (rent.penaltyAmount || 0);
  const paid = rent.amountPaid || totalDue;
  const status = paid >= totalDue ? "paid" : "partial";

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
  rentId = validateAndGetCleanId(rentId, "Rent record");
  if (pgId && typeof pgId === "string") pgId = pgId.trim();

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

