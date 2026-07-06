/**
 * onboarding.controller.js
 *
 * Thin HTTP handlers — reads from req, calls onboardingService, sends response.
 * All business logic lives in onboarding.service.js.
 */

const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const sendResponse = require("../utils/sendResponse");
const { onboardingService } = require("../services");

// ─────────────────────────────────────────────────────────────────────────────
// Staff endpoints
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /onboarding/initiate
 * Creates a new onboarding record for a tenant with a dealDone enquiry.
 */
const initiateOnboarding = catchAsync(async (req, res) => {
  const onboarding = await onboardingService.initiateOnboarding(
    req.body.enquiryId,
    req.user._id
  );
  return sendResponse(res, {
    statusCode: httpStatus.CREATED,
    message: "Onboarding initiated successfully",
    data: onboarding,
  });
});

/**
 * GET /onboarding/:id
 * Full detail view (staff or the tenant themselves).
 */
const getOnboarding = catchAsync(async (req, res) => {
  const onboarding = await onboardingService.getOnboarding(
    req.params.id,
    req.user
  );
  return sendResponse(res, {
    message: "Onboarding fetched successfully",
    data: onboarding,
  });
});

/**
 * GET /onboarding/pg/:pgId
 * Paginated list of onboardings for a PG.
 */
const listOnboardings = catchAsync(async (req, res) => {
  const result = await onboardingService.listOnboardings(
    req.params.pgId,
    {
      status: req.query.status,
      page: req.query.page,
      limit: req.query.limit,
    },
    req.user._id
  );
  return sendResponse(res, {
    message: "Onboardings fetched successfully",
    data: result,
  });
});

/**
 * PATCH /onboarding/:id/step
 * Update one or more step fields (emergencyContact, docs, financialTerms, etc.).
 */
const updateStep = catchAsync(async (req, res) => {
  const onboarding = await onboardingService.updateOnboardingStep(
    req.params.id,
    req.user._id,
    req.body
  );
  return sendResponse(res, {
    message: "Onboarding step updated successfully",
    data: onboarding,
  });
});



/**
 * POST /onboarding/:id/assign-bed
 * Final gated step — assigns a bed to the tenant.
 */
const assignBed = catchAsync(async (req, res) => {
  const onboarding = await onboardingService.assignBed(
    req.params.id,
    req.body.bedId,
    req.user._id
  );
  return sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Bed assigned and onboarding completed",
    data: onboarding,
  });
});

/**
 * POST /onboarding/shift-bed
 * Move an active tenant to a different bed within the same PG.
 */
const shiftBed = catchAsync(async (req, res) => {
  const result = await onboardingService.shiftBed(
    req.body.userId,
    req.body.pgId,
    req.body.newBedId,
    req.body.effectiveDate,
    req.body.shiftNote,
    req.user._id
  );
  return sendResponse(res, {
    message: "Tenant shifted to new bed successfully",
    data: result,
  });
});

/**
 * POST /onboarding/offboard
 * Offboard a tenant — settle deposit and vacate their bed.
 */
const offboardTenant = catchAsync(async (req, res) => {
  const { onboardingId, ...offboardData } = req.body;
  const onboarding = await onboardingService.offboardTenant(
    onboardingId,
    offboardData,
    req.user._id
  );
  return sendResponse(res, {
    message: "Tenant offboarded successfully",
    data: onboarding,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tenant self-service endpoints
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /onboarding/my-pg
 * Tenant reads their current PG, bed, and onboarding info.
 */
const getMyPGInfo = catchAsync(async (req, res) => {
  const result = await onboardingService.getMyPGInfo(req.user._id);
  return sendResponse(res, {
    message: result ? "PG info fetched successfully" : "No active PG assignment found",
    data: result,
  });
});

/**
 * GET /onboarding/my-history
 * Tenant views their complete bed-assignment history across all PGs.
 */
const getBedHistory = catchAsync(async (req, res) => {
  const history = await onboardingService.getBedHistory(req.user._id);
  return sendResponse(res, {
    message: "Bed history fetched successfully",
    data: history,
  });
});

module.exports = {
  initiateOnboarding,
  getOnboarding,
  listOnboardings,
  updateStep,
  assignBed,
  shiftBed,
  offboardTenant,
  getMyPGInfo,
  getBedHistory,
};
