const mongoose = require("mongoose");
const { SCHEMA_NAME } = require("../const/constant");

const PAYMENT_MODES = ["cash", "upi", "bank_transfer", "cheque", "online"];
const PAYMENT_STATUS = ["pending", "under_review", "paid", "partial", "overdue"];

const rentPaymentSchema = mongoose.Schema(
  {
    bedId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: SCHEMA_NAME.bed,
      required: true,
    },
    roomId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: SCHEMA_NAME.room,
      required: true,
    },
    pgId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: SCHEMA_NAME.pg,
      required: true,
    },
    userId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: SCHEMA_NAME.user,
      required: true,
    },
    // "2025-05" — the month this payment is FOR (not when it was paid)
    rentMonth: {
      type: String,
      required: true,
      match: [/^\d{4}-(0[1-9]|1[0-2])$/, "Format must be YYYY-MM"],
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: PAYMENT_STATUS,
      default: "pending",
    },
    paymentMode: {
      type: String,
      enum: PAYMENT_MODES,
      default: null,
    },
    paidDate: {
      type: Date,
      default: null,
    },
    referenceNo: {
      type: String,
      trim: true,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: null,
    },
    recordedBy: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: SCHEMA_NAME.user,
      default: null,
    },
    penaltyAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isPenaltyApplied: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },

  { timestamps: true }
);

// Compound index to prevent duplicate rent records for same tenant/bed/month
rentPaymentSchema.index({ bedId: 1, userId: 1, rentMonth: 1 }, { unique: true });
rentPaymentSchema.index({ pgId: 1, rentMonth: 1 });
rentPaymentSchema.index({ userId: 1, rentMonth: 1 });

const RentPayment = mongoose.model("RentPayment", rentPaymentSchema);

module.exports = RentPayment;
