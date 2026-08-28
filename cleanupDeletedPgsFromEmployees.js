const mongoose = require("mongoose");
const config = require("./src/config/config");
const { Employee, PG } = require("./src/models");

async function runCleanup() {
  await mongoose.connect(config.mongoose.url, config.mongoose.options);
  console.log("✅ Connected to MongoDB!");

  // Find all soft-deleted PGs
  const deletedPgs = await PG.find({ isDeleted: true }, "_id name");
  const deletedPgIds = new Set(deletedPgs.map(pg => String(pg._id)));
  console.log(`Found ${deletedPgs.length} soft-deleted PGs:`, deletedPgs.map(pg => pg.name).join(", "));

  if (deletedPgs.length === 0) {
    console.log("No deleted PGs to clean up from staff assignments.");
    return;
  }

  // Find all active employees
  const employees = await Employee.find({ isDeleted: false }).populate("userId");
  console.log(`Found ${employees.length} active staff records to check.`);

  let cleanedCount = 0;

  for (const emp of employees) {
    const user = emp.userId;
    if (!user) continue;

    const originalPgCount = emp.pgIds.length;
    const activePgIds = emp.pgIds.filter(id => !deletedPgIds.has(String(id)));

    if (activePgIds.length !== originalPgCount) {
      console.log(`Cleaning up orphaned assignments for "${user.name}" (${user.role}):`);
      console.log(`- Original PGs: ${originalPgCount}, Active PGs remaining: ${activePgIds.length}`);

      // Filter salaries map
      const cleanedPgSalaries = {};
      let totalSalary = 0;

      if (emp.pgSalaries) {
        const salariesObj = emp.pgSalaries instanceof Map ? Object.fromEntries(emp.pgSalaries) : emp.pgSalaries;
        for (const activePgId of activePgIds) {
          const pgIdStr = String(activePgId);
          if (salariesObj[pgIdStr] !== undefined) {
            cleanedPgSalaries[pgIdStr] = salariesObj[pgIdStr];
            totalSalary += Number(salariesObj[pgIdStr]) || 0;
          }
        }
      }

      console.log(`- Original Monthly Salary: ₹${emp.monthlySalary}, Recalculated: ₹${totalSalary}`);

      // Update fields
      emp.pgIds = activePgIds;
      emp.pgSalaries = cleanedPgSalaries;
      emp.monthlySalary = totalSalary;

      await emp.save();
      cleanedCount++;
      console.log(`- Updated successfully!`);
    }
  }

  console.log(`✅ Cleanup completed! Cleaned up assignments for ${cleanedCount} staff members.`);
}

runCleanup()
  .catch((err) => {
    console.error("❌ Error running cleanup:", err);
    process.exit(1);
  })
  .finally(() => {
    mongoose.connection.close();
    process.exit(0);
  });
