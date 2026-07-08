/**
 * onboarding.route.js
 *
 * IMPORTANT — Route ordering:
 *   Static/specific paths MUST be declared before parameterised ones.
 *   e.g. /my-pg, /my-history, /shift-bed, /offboard, /pg/:pgId/...
 *   must all come before /:id and /:id/... to avoid Express treating
 *   "my-pg" or "shift-bed" as an :id value.
 */

const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const onboardingController = require("../controllers/onboarding.controller");
const {
  initiateOnboarding,
  updateStep,
  assignBed,
  shiftBed,
  offboardTenant,
  getOnboardings,
} = require("../validations/onboarding.validation");

// ─────────────────────────────────────────────────────────────────────────────
// 1. Tenant self-service (static paths — must come BEFORE /:id)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /onboarding/tenant/my-pg
 * Tenant reads their current PG, bed, and onboarding summary.
 */
router.get(
  "/tenant/my-pg",
  auth("user"),
  onboardingController.getMyPGInfo
);

/**
 * GET /onboarding/tenant/history
 * Tenant reads their full bed-assignment history across all PGs.
 */
router.get(
  "/tenant/history",
  auth("user"),
  onboardingController.getBedHistory
);

// ─────────────────────────────────────────────────────────────────────────────
// 2. Staff bulk / action routes (static paths — must come BEFORE /:id)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /onboarding/initiate
 * Start a new onboarding process for a tenant with a dealDone enquiry.
 */
router.post(
  "/initiate",
  auth("owner", "manager"),
  validate(initiateOnboarding),
  onboardingController.initiateOnboarding
);

/**
 * POST /onboarding/shift-bed
 * Move an active tenant to a different bed within the same PG.
 */
router.post(
  "/shift-bed",
  auth("owner", "manager"),
  validate(shiftBed),
  onboardingController.shiftBed
);

/**
 * POST /onboarding/offboard
 * Offboard a tenant — settle deposit and vacate their bed.
 */
router.post(
  "/offboard",
  auth("owner", "manager"),
  validate(offboardTenant),
  onboardingController.offboardTenant
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. PG-level rules routes (static sub-paths — must come BEFORE /:id)
// ─────────────────────────────────────────────────────────────────────────────



/**
 * GET /onboarding/pg/:pgId
 * List all onboardings for a PG (paginated, filterable by status).
 */
router.get(
  "/pg/:pgId",
  auth("owner", "manager"),
  validate(getOnboardings),
  onboardingController.listOnboardings
);

// ─────────────────────────────────────────────────────────────────────────────
// 4. Single-onboarding routes (parameterised — MUST come AFTER all statics)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /onboarding/:id
 * Full detail view — accessible by owner/manager of the PG or the tenant.
 */
router.get(
  "/:id",
  auth("owner", "manager", "user"),
  onboardingController.getOnboarding
);

/**
 * PATCH /onboarding/:id/step
 * Patch one or more step fields (emergencyContact, docs, financialTerms, etc.).
 */
router.patch(
  "/:id/step",
  auth("owner", "manager"),
  validate(updateStep),
  onboardingController.updateStep
);



/**
 * POST /onboarding/:id/assign-bed
 * Hard-gated final step: assign a bed after rules + deposit gates pass.
 */
router.post(
  "/:id/assign-bed",
  auth("owner", "manager"),
  validate(assignBed),
  onboardingController.assignBed
);

module.exports = router;
