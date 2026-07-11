/**
 * migrate_onboarding_status.js
 *
 * One-time database migration script.
 *
 * Purpose: Rename all Onboarding records with status "completed" to "onboarding_completed".
 * This is necessary because:
 *  - We added a new "settlement_pending" status for the offboarding flow.
 *  - "completed" is now renamed to "onboarding_completed" to be explicit.
 *
 * Usage:
 *   node src/scratch/migrate_onboarding_status.js
 *
 * SAFE TO RUN: Uses updateMany — no data is deleted.
 */

require("dotenv").config();

const mongoose = require("mongoose");

const DB_URL =
  process.env.MONGODB_URL ||
  process.env.MONGODB_URI ||
  process.env.DB_URL ||
  "mongodb://127.0.0.1:27017/pg-management";

async function run() {
  console.log("🔌 Connecting to MongoDB...");
  await mongoose.connect(DB_URL);
  console.log("✅ Connected.\n");

  // Access the raw collection to bypass schema enum validation
  const collection = mongoose.connection.db.collection("onboardings");

  // Count affected records first
  const countBefore = await collection.countDocuments({ status: "completed" });
  console.log(`📊 Found ${countBefore} record(s) with status = "completed"`);

  if (countBefore === 0) {
    console.log("✅ Nothing to migrate. Exiting.");
    await mongoose.disconnect();
    return;
  }

  // Perform the migration
  const result = await collection.updateMany(
    { status: "completed" },
    { $set: { status: "onboarding_completed" } }
  );

  console.log(
    `\n✅ Migration complete! Updated ${result.modifiedCount} record(s).`
  );
  console.log(`   Matched:  ${result.matchedCount}`);
  console.log(`   Modified: ${result.modifiedCount}`);

  // Verify
  const countAfter = await collection.countDocuments({ status: "completed" });
  const countNew = await collection.countDocuments({
    status: "onboarding_completed",
  });
  console.log(`\n📊 Post-migration counts:`);
  console.log(`   status="completed"            → ${countAfter} record(s)`);
  console.log(`   status="onboarding_completed" → ${countNew} record(s)`);

  await mongoose.disconnect();
  console.log("\n🔌 Disconnected. Done.");
}

run().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
