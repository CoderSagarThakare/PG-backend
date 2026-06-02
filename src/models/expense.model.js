const mongoose = require("mongoose");
const { SCHEMA_NAME } = require("../const/constant");

const EXPENSE_STATUS = ["pending", "approved", "rejected"];
const REIMBURSEMENT_TYPE = ["direct", "add_to_salary"];
const PAYOUT_STATUS = ["unpaid", "paid"];

/**
 * Tracks business expenses submitted by or on behalf of an employee/manager.
 */
const expenseSchema = mongoose.Schema(
  {
    // The user (employee/manager) who actually spent the money
    spentBy: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: SCHEMA_NAME.user,
      required: true,
    },
    // If an owner/manager submitted on behalf of someone
    submittedBy: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: SCHEMA_NAME.user,
      default: null,
    },
    pgId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: SCHEMA_NAME.pg,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      trim: true,
      default: "General",
    },
    spentDate: {
      type: Date,
      required: true,
    },
    // Up to 3 receipt photo URLs/file paths
    photos: {
      type: [String],
      default: [],
      validate: {
        validator: (v) => v.length <= 3,
        message: "Maximum 3 receipt photos allowed",
      },
    },
    status: {
      type: String,
      enum: EXPENSE_STATUS,
      default: "pending",
    },
    // Owner/manager who approved or rejected this claim
    approvedBy: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: SCHEMA_NAME.user,
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: null,
    },
    // How the approved expense will be reimbursed
    reimbursementType: {
      type: String,
      enum: REIMBURSEMENT_TYPE,
      default: null,
    },
    payoutStatus: {
      type: String,
      enum: PAYOUT_STATUS,
      default: "unpaid",
    },
    reimbursedDate: {
      type: Date,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

expenseSchema.index({ pgId: 1, status: 1 });
expenseSchema.index({ spentBy: 1, status: 1 });

const Expense = mongoose.model("Expense", expenseSchema);
module.exports = Expense;
