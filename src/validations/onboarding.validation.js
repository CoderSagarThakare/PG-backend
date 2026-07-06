const Joi = require("joi");
const { objectId } = require("./custom.validation");

// ── Reusable helpers ──────────────────────────────────────────────────────────

const objectIdField = Joi.string().custom(objectId);

// ── Validations ───────────────────────────────────────────────────────────────

/**
 * POST /onboarding/initiate
 * Start an onboarding process for a tenant with a dealDone enquiry.
 */
const initiateOnboarding = {
  body: Joi.object().keys({
    enquiryId: objectIdField.required(),
  }),
};

/**
 * PATCH /onboarding/:id/step
 * Patch any combination of step fields in a single call.
 * At least one field must be present.
 */
const updateStep = {
  body: Joi.object()
    .keys({
      emergencyContact: Joi.object().keys({
        name: Joi.string().trim(),
        phone: Joi.string().trim().pattern(/^[6-9]\d{9}$/).messages({
          "string.pattern.base": "Phone number must be a valid 10-digit mobile number"
        }),
        relation: Joi.string().valid(
          "father",
          "mother",
          "spouse",
          "sibling",
          "friend",
          "other"
        ),
      }),
      documentsReviewed: Joi.object().keys({
        reviewedAt: Joi.date(),
        reviewedBy: objectIdField,
      }),
      financialTerms: Joi.object().keys({
        securityDepositAmount: Joi.number().min(0),
        securityDepositReceived: Joi.boolean(),
        securityDepositReference: Joi.string().allow("", null),
        securityDepositDate: Joi.date(),
      }),
      joiningDate: Joi.date(),
      notes: Joi.string().trim(),
    })
    .min(1),
};

/**
 * POST /onboarding/:id/confirm-deposit  (called via updateStep in practise, kept for explicitness)
 * Confirm the security deposit has been received.
 */
const confirmDeposit = {
  body: Joi.object().keys({
    securityDepositReceived: Joi.boolean().required(),
    securityDepositReference: Joi.string().trim(),
    securityDepositDate: Joi.date(),
  }),
};



/**
 * POST /onboarding/:id/assign-bed
 */
const assignBed = {
  body: Joi.object().keys({
    bedId: objectIdField.required(),
  }),
};

/**
 * POST /onboarding/shift-bed
 */
const shiftBed = {
  body: Joi.object().keys({
    userId: objectIdField.required(),
    pgId: objectIdField.required(),
    newBedId: objectIdField.required(),
    effectiveDate: Joi.date().required(),
    shiftNote: Joi.string().trim(),
  }),
};

/**
 * POST /onboarding/offboard
 */
const offboardTenant = {
  body: Joi.object().keys({
    onboardingId: objectIdField.required(),
    vacatingDate: Joi.date().required(),
    deductions: Joi.number().min(0).default(0),
    deductionNotes: Joi.string().trim(),
    pendingRent: Joi.number().min(0).default(0),
    settlementReference: Joi.string().trim(),
  }),
};

/**
 * GET /onboarding/pg/:pgId
 * List all onboardings for a PG with optional filters.
 */
const getOnboardings = {
  query: Joi.object().keys({
    pgId: objectIdField,
    status: Joi.string().valid(
      "initiated",
      "docs_reviewed",
      "deposit_confirmed",
      "completed",
      "removed"
    ),
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
  }),
};

module.exports = {
  initiateOnboarding,
  updateStep,
  confirmDeposit,
  assignBed,
  shiftBed,
  offboardTenant,
  getOnboardings,
};
