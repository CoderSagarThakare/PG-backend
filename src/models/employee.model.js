const mongoose = require("mongoose");
const { SCHEMA_NAME } = require("../const/constant");

/**
 * Represents a staff member linked to an existing User account.
 * Role (employee/manager) is derived from the User document itself.
 */
const employeeSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: SCHEMA_NAME.user,
      required: true,
    },
    pgIds: [{
      type: mongoose.SchemaTypes.ObjectId,
      ref: SCHEMA_NAME.pg,
      required: true,
    }],
    joinedDate: {
      type: Date,
      required: true,
    },
    monthlySalary: {
      type: Number,
      required: true,
      min: 0,
    },
    pgSalaries: {
      type: Map,
      of: Number,
      default: {},
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    notes: {
      type: String,
      trim: true,
      default: null,
    },
    addedBy: {
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

// One active staff record per user
employeeSchema.index({ userId: 1 }, { unique: true, sparse: true });
employeeSchema.index({ pgIds: 1, status: 1 });

const Employee = mongoose.model("Employee", employeeSchema);
module.exports = Employee;
