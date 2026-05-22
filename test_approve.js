const mongoose = require("mongoose");
const config = require("./src/config/config");
const rentService = require("./src/services/rent.service");

async function test() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    console.log("Connected successfully!");

    const rentId = "6a10c0ff4636836ad2e8b9ad";
    const recordedBy = new mongoose.Types.ObjectId("6a06218625ad4879dd750f1b"); // some valid ObjectId format
    const pgId = ""; // empty string

    console.log(`Calling approvePayment with rentId=${rentId}, pgId="${pgId}"`);
    const result = await rentService.approvePayment(rentId, recordedBy, pgId);
    console.log("Success! Result:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error encountered:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected.");
  }
}

test();
