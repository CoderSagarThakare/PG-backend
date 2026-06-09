const mongoose = require("mongoose");
const { SCHEMA_NAME } = require("../const/constant");

const STAFF_PAYMENT_STATUS = ["pending", "paid"];
const PAYMENT_MODES = ["cash", "upi", "bank_transfer", "cheque", "online"];

/**
 * Monthly salary payout record for a staff member.
 * totalAmount = salaryAmount + reimbursedExpenses (direct reimbursements added to salary)
 */
const staffPaymentSchema = mongoose.Schema(
  {
    employeeId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: "Employee",
      required: true,
    },
    pgId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: SCHEMA_NAME.pg,
      required: true,
    },
    month: {
      type: String,
      required: true,
      match: [/^\d{4}-(0[1-9]|1[0-2])$/, "Format must be YYYY-MM"],
    },
    salaryAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    // Sum of approved 'add_to_salary' expenses for this month
    reimbursedExpenses: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: STAFF_PAYMENT_STATUS,
      default: "pending",
    },
    paidDate: {
      type: Date,
      default: null,
    },
    paymentMode: {
      type: String,
      enum: PAYMENT_MODES,
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
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// One payroll record per employee per month per PG
staffPaymentSchema.index({ employeeId: 1, month: 1, pgId: 1 }, { unique: true });
staffPaymentSchema.index({ pgId: 1, month: 1 });

const StaffPayment = mongoose.model("StaffPayment", staffPaymentSchema);
module.exports = StaffPayment;
