const cron = require("node-cron");
const { PG } = require("../models");
const rentService = require("../services/rent.service");
const logger = require("../config/logger");

/**
 * Initializes all cron jobs for the application.
 * All cron jobs are configured to run in Asia/Kolkata timezone to align with Indian local time.
 */
const startCronJobs = () => {
  const cronOptions = {
    scheduled: true,
    timezone: "Asia/Kolkata"
  };

  // 1. Daily Overdue Check (Runs at 12:01 AM IST every day)
  cron.schedule(
    "1 0 * * *",
    async () => {
      try {
        logger.info("Cron: Starting daily overdue rent checks...");
        const pgs = await PG.find({ isDeleted: false }, "_id");
        const pgIds = pgs.map((p) => p._id);

        if (pgIds.length > 0) {
          await rentService.checkAndApplyOverduePayments(pgIds);
          logger.info(`Cron: Checked and applied overdue rents for ${pgIds.length} PGs.`);
        } else {
          logger.info("Cron: No active PGs found for overdue checks.");
        }
      } catch (err) {
        logger.error("Cron Error: Daily overdue check failed:", err);
      }
    },
    cronOptions
  );

  // 2. Month-Start Rent Generation (Runs at 12:05 AM IST on the 1st of every month)
  cron.schedule(
    "5 0 1 * *",
    async () => {
      try {
        logger.info("Cron: Generating monthly rent bills for all active PGs...");
        const pgs = await PG.find({ isDeleted: false }, "_id");

        const now = new Date();
        // Render month in YYYY-MM format
        const rentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

        let totalCreated = 0;
        let totalSkipped = 0;

        for (const pg of pgs) {
          try {
            const result = await rentService.generateMonthlyRent(pg._id, rentMonth, null);
            totalCreated += result.created;
            totalSkipped += result.skipped;
          } catch (pgErr) {
            logger.error(`Cron Error: Rent generation failed for PG ID ${pg._id}:`, pgErr);
          }
        }
        logger.info(`Cron: Generated ${totalCreated} rent bills (skipped ${totalSkipped}) for month ${rentMonth}.`);
      } catch (err) {
        logger.error("Cron Error: Monthly rent generation failed:", err);
      }
    },
    cronOptions
  );

};

module.exports = { startCronJobs };
