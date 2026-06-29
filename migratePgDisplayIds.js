const mongoose = require("mongoose");
const config = require("./src/config/config");
const { PG, Counter } = require("./src/models");

async function runMigration() {
  await mongoose.connect(config.mongoose.url, config.mongoose.options);
  console.log("✅ Connected to MongoDB!");

  // Find all PGs, sorted by createdAt (oldest first)
  const pgs = await PG.find({}).sort({ createdAt: 1 });
  console.log(`Found ${pgs.length} total PG records in database.`);

  let nextSeq = 1000;

  for (const pg of pgs) {
    if (pg.pgDisplayId) {
      console.log(`PG "${pg.name}" already has ID: ${pg.pgDisplayId}`);
      // Parse sequence number from existing display ID (e.g., "PG-1002" -> 1002)
      const match = pg.pgDisplayId.match(/^PG-(\d+)$/);
      if (match) {
        const seqNum = parseInt(match[1], 10);
        if (seqNum >= nextSeq) {
          nextSeq = seqNum + 1;
        }
      }
    } else {
      pg.pgDisplayId = `PG-${nextSeq}`;
      await pg.save();
      console.log(`Assigned ID "${pg.pgDisplayId}" to PG "${pg.name}"`);
      nextSeq++;
    }
  }

  // Update the counter collection to seed it for future creations
  const finalSeq = nextSeq - 1; // Last assigned sequence number
  await Counter.findOneAndUpdate(
    { _id: "pgDisplayId" },
    { $set: { seq: Math.max(finalSeq, 999) } },
    { upsert: true, new: true }
  );

  console.log(`✅ Counter "pgDisplayId" updated to: ${Math.max(finalSeq, 999)}`);
  console.log("✅ PG display ID migration completed successfully!");
}

runMigration()
  .catch((err) => {
    console.error("❌ Error running migration:", err);
    process.exit(1);
  })
  .finally(() => {
    mongoose.connection.close();
    process.exit(0);
  });
