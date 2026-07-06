const mongoose = require("mongoose");
const { SCHEMA_NAME } = require("../const/constant");

const { ObjectId } = mongoose.Schema.Types;

/**
 * BedAssignment Schema
 *
 * An immutable audit trail of which bed(s) a tenant has occupied over time.
 * A record with endDate === null represents the current active assignment.
 * When a tenant shifts rooms or is offboarded, the old record gets an endDate
 * and a new record is created (if shifting) or none (if offboarding).
 */
const bedAssignmentSchema = new mongoose.Schema(
  {
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
    bedId: {
      type: ObjectId,
      ref: SCHEMA_NAME.bed,
      required: true,
    },
    /** Denormalised roomId for fast queries without extra population */
    roomId: {
      type: ObjectId,
      ref: SCHEMA_NAME.room,
      required: true,
    },
    onboardingId: {
      type: ObjectId,
      ref: SCHEMA_NAME.onboarding,
      required: true,
    },

    startDate: { type: Date, required: true },

    /** null = currently active; populated when the tenant shifts or leaves */
    endDate: { type: Date, default: null },

    /** Reason this assignment was created */
    shiftReason: {
      type: String,
      enum: ["initial_onboarding", "room_shift", "offboarding"],
      default: "initial_onboarding",
    },

    /** Optional note explaining the reason for a room shift */
    shiftNote: { type: String, trim: true },

    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// ── Indexes ──────────────────────────────────────────────────────────────────

// Find a user's current active assignment across all PGs
bedAssignmentSchema.index({ userId: 1, pgId: 1, endDate: 1 });

// Check bed availability / history
bedAssignmentSchema.index({ bedId: 1, endDate: 1 });

const BedAssignment = mongoose.model(
  SCHEMA_NAME.bedAssignment,
  bedAssignmentSchema
);

module.exports = BedAssignment;
