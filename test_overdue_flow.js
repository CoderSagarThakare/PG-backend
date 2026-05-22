const mongoose = require("mongoose");
const config = require("./src/config/config");
const { RentPayment, Bed, Room, PG, User } = require("./src/models");
const rentService = require("./src/services/rent.service");

async function test() {
  let pgToRestore = null;
  let bedToRestore = null;
  let originalDueDay = 10;
  let originalLateFee = 0;
  let originalAssignedAt = null;
  let dummyRentId = null;
  let midMonthRentId = null;

  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    console.log("Connected successfully!");

    // Fetch mock data
    const user = await User.findOne({ role: "user" });
    const pg = await PG.findOne({ isDeleted: false });
    const room = await Room.findOne({ pgId: pg._id, isDeleted: false });
    const bed = await Bed.findOne({ roomId: room._id, isDeleted: false });
    const staff = await User.findOne({ role: { $in: ["owner", "manager"] } });

    if (!user || !pg || !room || !bed || !staff) {
      console.error("Missing mock data in database!");
      return;
    }

    pgToRestore = pg;
    originalDueDay = pg.dueDayOfMonth ?? 10;
    originalLateFee = pg.lateFee ?? 0;

    bedToRestore = bed;
    originalAssignedAt = bed.assignedAt;

    // ─── TEST CASE 1: Standard Tenant (Joined in a previous month, should become Overdue) ───
    console.log("\n--- TEST CASE 1: Standard Tenant Overdue & Penalty Flow ---");
    
    // Ensure bed assignedAt is in the past (e.g. April 1st) so they are living there from 1st day of May
    bed.assignedAt = new Date("2026-04-01T12:00:00Z");
    await bed.save();

    // Configure PG settings so overdue criteria is met
    // Today is May 23rd, 2026. Set due date to 10th of the month, late fee to 150
    console.log("Configuring PG settings with dueDayOfMonth = 10 and lateFee = 150...");
    pg.dueDayOfMonth = 10;
    pg.lateFee = 150;
    await pg.save();

    console.log("Creating dummy pending rent record for May 2026 (due date was May 10th)...");
    const dummyRent = await RentPayment.create({
      bedId: bed._id,
      roomId: room._id,
      pgId: pg._id,
      userId: user._id,
      rentMonth: "2026-05",
      amount: 4000,
      amountPaid: 0,
      status: "pending",
      isPenaltyApplied: false,
      penaltyAmount: 0,
    });
    dummyRentId = dummyRent._id;
    console.log(`Created rent record ID: ${dummyRentId}, status: ${dummyRent.status}`);

    console.log("Fetching payments via rentService.getRentPayments (triggers overdue check)...");
    await rentService.getRentPayments({ pgId: pg._id });
    
    // Retrieve the updated record
    const updatedRent = await RentPayment.findById(dummyRentId);
    console.log("Updated rent record status:", updatedRent.status);
    console.log("penaltyAmount:", updatedRent.penaltyAmount);
    console.log("isPenaltyApplied:", updatedRent.isPenaltyApplied);

    // Asserts
    if (updatedRent.status !== "overdue") {
      throw new Error(`Expected status 'overdue', but got: ${updatedRent.status}`);
    }
    if (updatedRent.penaltyAmount !== 150) {
      throw new Error(`Expected penaltyAmount 150, but got: ${updatedRent.penaltyAmount}`);
    }
    if (updatedRent.isPenaltyApplied !== true) {
      throw new Error(`Expected isPenaltyApplied to be true, but got: ${updatedRent.isPenaltyApplied}`);
    }
    console.log("✅ Standard overdue and penalty transition passed!");

    console.log("Testing payment proof submission for full amount + penalty (4000 + 150 = 4150)...");
    await rentService.submitPaymentProof(user._id, dummyRentId, {
      paymentMode: "upi",
      referenceNo: "REF_OVERDUE_PAY",
      amountPaid: 4150,
      notes: "Paying rent and late fee"
    });

    const afterSubmit = await RentPayment.findById(dummyRentId);
    console.log("After proof submission, status:", afterSubmit.status, "amountPaid:", afterSubmit.amountPaid);
    if (afterSubmit.status !== "under_review") {
      throw new Error(`Expected status 'under_review', but got: ${afterSubmit.status}`);
    }

    console.log("Approving payment as owner...");
    const afterApprove = await rentService.approvePayment(dummyRentId, staff._id, pg._id);
    console.log("After approval, status:", afterApprove.status, "amountPaid:", afterApprove.amountPaid);
    if (afterApprove.status !== "paid") {
      throw new Error(`Expected status 'paid', but got: ${afterApprove.status}`);
    }
    console.log("✅ Payment approval assertion passed!");

    // Clean up Test Case 1 record
    await RentPayment.deleteOne({ _id: dummyRentId });
    dummyRentId = null;

    // ─── TEST CASE 2: Mid-Month Joined Tenant (Joined on 15th, should NOT become Overdue) ───
    console.log("\n--- TEST CASE 2: Mid-Month Joined Tenant Flow ---");
    
    // Set bed assignedAt to May 15th, 2026 (mid-month join for the May 2026 bill)
    console.log("Setting bed assignedAt to May 15th, 2026...");
    bed.assignedAt = new Date("2026-05-15T12:00:00Z");
    await bed.save();

    console.log("Creating dummy pending rent record for May 2026 (due date was May 10th, but joined mid-month)...");
    const midMonthRent = await RentPayment.create({
      bedId: bed._id,
      roomId: room._id,
      pgId: pg._id,
      userId: user._id,
      rentMonth: "2026-05",
      amount: 2000, // prorated amount
      amountPaid: 0,
      status: "pending",
      isPenaltyApplied: false,
      penaltyAmount: 0,
    });
    midMonthRentId = midMonthRent._id;
    console.log(`Created mid-month rent record ID: ${midMonthRentId}, status: ${midMonthRent.status}`);

    console.log("Fetching payments via rentService.getRentPayments (triggers overdue check)...");
    await rentService.getRentPayments({ pgId: pg._id });

    // Retrieve the updated record
    const updatedMidMonthRent = await RentPayment.findById(midMonthRentId);
    console.log("Updated mid-month rent record status:", updatedMidMonthRent.status);
    console.log("penaltyAmount:", updatedMidMonthRent.penaltyAmount);
    console.log("isPenaltyApplied:", updatedMidMonthRent.isPenaltyApplied);

    // Asserts
    if (updatedMidMonthRent.status !== "pending") {
      throw new Error(`Expected status to remain 'pending' for mid-month join, but got: ${updatedMidMonthRent.status}`);
    }
    if (updatedMidMonthRent.penaltyAmount !== 0) {
      throw new Error(`Expected penaltyAmount to remain 0, but got: ${updatedMidMonthRent.penaltyAmount}`);
    }
    if (updatedMidMonthRent.isPenaltyApplied !== false) {
      throw new Error(`Expected isPenaltyApplied to be false, but got: ${updatedMidMonthRent.isPenaltyApplied}`);
    }
    console.log("✅ Mid-month join skip overdue check passed!");

  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    // Clean up
    if (dummyRentId) {
      console.log("Cleaning up dummy Rent record...");
      await RentPayment.deleteOne({ _id: dummyRentId });
    }
    if (midMonthRentId) {
      console.log("Cleaning up mid-month Rent record...");
      await RentPayment.deleteOne({ _id: midMonthRentId });
    }
    if (pgToRestore) {
      console.log(`Restoring PG configuration to dueDayOfMonth = ${originalDueDay}, lateFee = ${originalLateFee}...`);
      pgToRestore.dueDayOfMonth = originalDueDay;
      pgToRestore.lateFee = originalLateFee;
      await pgToRestore.save();
    }
    if (bedToRestore) {
      console.log("Restoring Bed assignedAt date...");
      bedToRestore.assignedAt = originalAssignedAt;
      await bedToRestore.save();
    }
    await mongoose.disconnect();
    console.log("Disconnected.");
  }
}

test();
