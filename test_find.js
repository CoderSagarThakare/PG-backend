const mongoose = require("mongoose");
const config = require("./src/config/config");
const { RentPayment } = require("./src/models");

async function test() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    console.log("Connected successfully!");

    const rents = await RentPayment.find({});
    console.log(`Checking validation for ${rents.length} rent records...`);
    let invalidCount = 0;
    for (const rent of rents) {
      const err = rent.validateSync();
      if (err) {
        invalidCount++;
        console.log(`INVALID Rent Record ID [${rent._id}]:`, err.message);
      }
    }
    if (invalidCount === 0) {
      console.log("All rent records are valid according to the schema!");
    } else {
      console.log(`Found ${invalidCount} invalid rent records.`);
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
  }
}

test();
