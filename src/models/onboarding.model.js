const mongoose = require("mongoose");
const { SCHEMA_NAME } = require("../const/constant");

const { ObjectId } = mongoose.Schema.Types;

/**
 * Onboarding Schema
 *
 * Tracks the full lifecycle of a tenant moving into a PG:
 *   initiated → docs_reviewed → rules_sent → rules_accepted
 *   → deposit_confirmed → completed
 * and eventually → removed (on offboarding)
 */
const onboardingSchema = new mongoose.Schema(
  {
    // ── Core references ─────────────────────────────────────────────────────
    enquiryId: {
      type: ObjectId,
      ref: SCHEMA_NAME.enquiry,
      required: true,
    },
    userId: {
      type: ObjectId,
      ref: SCHEMA_NAME.user,
      required: true,
    },
    pgId: {
      type: ObjectId,
      ref: SCHEMA_NAME.pg,
      required: true,
    },
    /** Owner or Manager who initiated / is managing this onboarding */
    processedBy: {
      type: ObjectId,
      ref: SCHEMA_NAME.user,
    },

    // ── Status ───────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: [
        "initiated",            // Step 0: record created
        "docs_reviewed",        // Step 1: documents reviewed
        "deposit_confirmed",    // Step 2: security deposit received
        "onboarding_completed", // Step 3: bed assigned, tenant moved in (renamed from 'completed')
        "settlement_pending",   // Step 4: offboarding initiated, awaiting tenant confirmation
        "removed",              // Step 5: tenant confirmed receipt, stay closed
        "cancelled",            // Step 6: onboarding reset/canceled before completion
      ],
      default: "initiated",
    },

    // ── Emergency contact ─────────────────────────────────────────────────
    emergencyContact: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
      relation: {
        type: String,
        enum: ["father", "mother", "spouse", "sibling", "friend", "other"],
      },
    },

    // ── Document review ───────────────────────────────────────────────────
    documentsReviewed: {
      reviewedAt: { type: Date },
      reviewedBy: { type: ObjectId, ref: SCHEMA_NAME.user },
    },

    // ── Financial terms negotiated during onboarding ──────────────────────
    financialTerms: {
      agreedRent: { type: Number, min: 0 },
      securityDepositAmount: { type: Number, min: 0, default: 0 },
      /** True once payment has been physically/digitally confirmed by staff */
      securityDepositReceived: { type: Boolean, default: false },
      securityDepositReference: { type: String },
      securityDepositDate: { type: Date },
      /** Day of month on which rent is due (overrides PG default if set) */
      dueDay: { type: Number, min: 1, max: 31 },
    },

    /** Agreed joining date */
    joiningDate: { type: Date },

    // ── Offboarding details (populated when status → 'settlement_pending' / 'removed') ──
    offboarding: {
      /** The date the tenant physically exits / vacates (renamed from vacatingDate) */
      exitDate: { type: Date },
      /** Reason given by owner for offboarding */
      reason: { type: String, trim: true },
      /** Monetary deductions from security deposit (damage, dues, etc.) */
      deductions: { type: Number, default: 0 },
      deductionNotes: { type: String },
      pendingRent: { type: Number, default: 0 },
      /** refundAmount = securityDepositAmount - deductions - pendingRent (≥0) */
      refundAmount: { type: Number, default: 0 },
      settlementReference: { type: String },
      /** Set when tenant confirms they received the refund (status → 'removed') */
      settlementConfirmedAt: { type: Date },
      processedBy: { type: ObjectId, ref: SCHEMA_NAME.user },
    },

    /** Timestamp when the onboarding reached 'completed' status */
    completedAt: { type: Date },

    /** Free-form notes by staff */
    notes: { type: String, trim: true },

    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// ── Indexes ──────────────────────────────────────────────────────────────────

// Fast lookup by enquiry + soft-delete filter
onboardingSchema.index({ enquiryId: 1, isDeleted: 1 });

// Strictly guarantee only one active (non-completed, non-removed, non-cancelled) onboarding exists per enquiry
onboardingSchema.index(
  { enquiryId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isDeleted: false,
      status: { $nin: ["onboarding_completed", "settlement_pending", "removed", "cancelled"] }
    }
  }
);

// Dashboard queries: all onboardings for a user inside a PG filtered by status
onboardingSchema.index({ userId: 1, pgId: 1, status: 1 });

// PG-level dashboard: filter by status
onboardingSchema.index({ pgId: 1, status: 1 });

// ── Middleware ────────────────────────────────────────────────────────────────

/**
 * Automatically exclude soft-deleted records from every find query
 * (mirrors the pattern used in enquiry.model.js)
 */
onboardingSchema.pre(/^find/, function (next) {
  if (this.getQuery().isDeleted === undefined) {
    this.where({ isDeleted: false });
  }
  next();
});

const Onboarding = mongoose.model(SCHEMA_NAME.onboarding, onboardingSchema);

module.exports = Onboarding;
