const mongoose = require("mongoose");
const config = require("./src/config/config");
const { RentPayment, Bed, Room, PG, User } = require("./src/models");
const rentService = require("./src/services/rent.service");

async function test() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    console.log("Connected successfully!");

    // Fetch existing PG, Room, Bed, and User to make a valid rent record
    const user = await User.findOne({ role: "user" });
    const pg = await PG.findOne({});
    const room = await Room.findOne({ pgId: pg._id });
    const bed = await Bed.findOne({ roomId: room._id });
    const staff = await User.findOne({ role: { $in: ["owner", "manager"] } });

    if (!user || !pg || !room || !bed || !staff) {
      console.error("Missing mock data in database!");
      return;
    }

    console.log("Creating dummy RentPayment under_review...");
    const dummyRent = await RentPayment.create({
      bedId: bed._id,
      roomId: room._id,
      pgId: pg._id,
      userId: user._id,
      rentMonth: "2026-04",
      amount: 5000,
      amountPaid: 5000,
      status: "under_review",
      paymentMode: "upi",
      referenceNo: "REF123456789",
      notes: "Test proof",
      paidDate: new Date(),
    });

    console.log(`Created rent payment with ID: ${dummyRent._id}`);

    console.log("Calling approvePayment...");
    const approved = await rentService.approvePayment(dummyRent._id, staff._id, "");
    console.log("Approved successfully! Status:", approved.status);

    // Clean up
    await RentPayment.deleteOne({ _id: dummyRent._id });
    console.log("Cleaned up dummy record.");
  } catch (error) {
    console.error("Error during flow test:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected.");
  }
}

test();
