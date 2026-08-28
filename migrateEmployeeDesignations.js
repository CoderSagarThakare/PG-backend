const mongoose = require("mongoose");
const config = require("./src/config/config");
const { Employee } = require("./src/models");

async function runMigration() {
  await mongoose.connect(config.mongoose.url, config.mongoose.options);
  console.log("✅ Connected to MongoDB!");

  const employees = await Employee.find({ isDeleted: false }).populate("userId");
  console.log(`Found ${employees.length} active staff records in database.`);

  let updatedCount = 0;

  for (const emp of employees) {
    const user = emp.userId;
    if (!user) {
      console.log(`⚠️ Staff record ${emp._id} has no linked user, skipping.`);
      continue;
    }

    let targetDesignation = emp.designation;

    // If designation is not set, or is 'other' but the user is actually a manager
    if (!emp.designation || (emp.designation === "other" && user.role === "manager")) {
      targetDesignation = user.role === "manager" ? "manager" : "other";
    }

    if (emp.designation !== targetDesignation) {
      emp.designation = targetDesignation;
      await emp.save();
      console.log(`Updated staff member "${user.name}" (${user.role}) designation to: "${targetDesignation}"`);
      updatedCount++;
    }
  }

  console.log(`✅ Designation migration completed successfully! Updated ${updatedCount} records.`);
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
