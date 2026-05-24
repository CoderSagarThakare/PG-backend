const express = require("express");
const router = express.Router();
const httpStatus = require("http-status");
const { PG } = require("../models");
const rentService = require("../services/rent.service");
const ApiError = require("../utils/ApiError");
const catchAsync = require("../utils/catchAsync");
const sendResponse = require("../utils/sendResponse");

/**
 * Middleware to secure cron trigger endpoints.
 * Requires x-cron-secret header or cron_secret query parameter to match CRON_SECRET env variable.
 */
const validateCronSecret = (req, res, next) => {
  const secret = req.headers["x-cron-secret"] || req.query.cron_secret;
  const configuredSecret = process.env.CRON_SECRET || "super-secret-cron-key-12345";

  if (!secret || secret !== configuredSecret) {
    return next(new ApiError(httpStatus.UNAUTHORIZED, "Unauthorized cron trigger request"));
  }
  next();
};

router.use(validateCronSecret);

/**
 * Manually trigger rent bill generation for the current month across all non-deleted PGs.
 * POST /cron/generate-monthly
 */
router.post(
  "/generate-monthly",
  catchAsync(async (req, res) => {
    const pgs = await PG.find({ isDeleted: false }, "_id");
    const now = new Date();
    const rentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    let totalCreated = 0;
    let totalSkipped = 0;

    for (const pg of pgs) {
      try {
        const result = await rentService.generateMonthlyRent(pg._id, rentMonth, null);
        totalCreated += result.created;
        totalSkipped += result.skipped;
      } catch (pgErr) {
        // Log individual PG error and continue with the rest
        console.error(`Cron trigger failed for PG ${pg._id}:`, pgErr);
      }
    }

    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: `Successfully executed monthly rent bill generation for ${rentMonth}`,
      data: { totalCreated, totalSkipped, pgCount: pgs.length }
    });
  })
);

/**
 * Manually trigger daily overdue and penalty checks for all PGs.
 * POST /cron/check-overdue
 */
router.post(
  "/check-overdue",
  catchAsync(async (req, res) => {
    const pgs = await PG.find({ isDeleted: false }, "_id");
    const pgIds = pgs.map((p) => p._id);

    if (pgIds.length > 0) {
      await rentService.checkAndApplyOverduePayments(pgIds);
    }

    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: "Successfully executed overdue rent checks",
      data: { pgCount: pgIds.length }
    });
  })
);

module.exports = router;
