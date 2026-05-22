const mongoose = require("mongoose");
const config = require("./src/config/config");
const { RentPayment } = require("./src/models");

async function test() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    console.log("Connected successfully!");

    const records = await RentPayment.find({}).limit(10).sort({ createdAt: -1 });
    console.log("Recent rent payments:");
    records.forEach(r => {
      console.log(`ID: ${r._id}, PG: ${r.pgId}, Status: ${r.status}, Month: ${r.rentMonth}`);
    });
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
  }
}

test();
