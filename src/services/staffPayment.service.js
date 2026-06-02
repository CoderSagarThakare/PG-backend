const mongoose = require("mongoose");
const { StaffPayment, Employee, Expense } = require("../models");
const ApiError = require("../utils/ApiError");
const httpStatus = require("http-status");

/**
 * Generate (or return existing) a payroll record for a staff member for a given month.
 * Automatically sums up approved 'add_to_salary' expenses for that month.
 */
const generatePayroll = async (employeeId, month, recordedBy) => {
  const employee = await Employee.findOne({ _id: employeeId, isDeleted: false })
    .populate("userId", "name role");
  if (!employee) throw new ApiError(httpStatus.NOT_FOUND, "Staff record not found");

  // Check if payroll already exists for this month
  const existing = await StaffPayment.findOne({ employeeId, month, isDeleted: false });
  if (existing) {
    return existing.populate([
      { path: "employeeId", populate: { path: "userId", select: "name email role picture" } },
      { path: "pgId", select: "name" },
    ]);
  }

  // Sum up approved add_to_salary expenses for this employee in this month
  const monthStart = new Date(`${month}-01T00:00:00.000Z`);
  const [year, monthNum] = month.split("-").map(Number);
  const monthEnd = new Date(year, monthNum, 0, 23, 59, 59, 999); // last day of month

  const expenses = await Expense.find({
    spentBy: employee.userId._id,
    status: "approved",
    reimbursementType: "add_to_salary",
    payoutStatus: "unpaid",
    spentDate: { $gte: monthStart, $lte: monthEnd },
    isDeleted: false,
  });

  const reimbursedExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalAmount = employee.monthlySalary + reimbursedExpenses;

  const payment = await StaffPayment.create({
    employeeId,
    pgId: employee.pgIds?.[0] || null,
    month,
    salaryAmount: employee.monthlySalary,
    reimbursedExpenses,
    totalAmount,
    recordedBy,
  });

  // Link those expenses to this payroll
  if (expenses.length > 0) {
    await Expense.updateMany(
      { _id: { $in: expenses.map(e => e._id) } },
      { payoutStatus: "paid", reimbursedDate: new Date() }
    );
  }

  return payment.populate([
    { path: "employeeId", populate: { path: "userId", select: "name email role picture" } },
    { path: "pgId", select: "name" },
  ]);
};

/**
 * Get all payroll records with filters.
 */
const getPayrolls = async ({ pgId, month, status, employeeId, page = 1, limit = 20 }) => {
  const filter = { isDeleted: false };
  if (pgId) filter.pgId = pgId;
  if (month) filter.month = month;
  if (status) filter.status = status;
  if (employeeId) filter.employeeId = employeeId;

  const skip = (page - 1) * limit;
  const [payments, total] = await Promise.all([
    StaffPayment.find(filter)
      .populate({
        path: "employeeId",
        populate: { path: "userId", select: "name email role picture mobNo1" }
      })
      .populate({ path: "pgId", select: "name" })
      .populate({ path: "recordedBy", select: "name" })
      .sort({ month: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    StaffPayment.countDocuments(filter),
  ]);

  return { payments, total, page: Number(page), limit: Number(limit) };
};

/**
 * Mark a payroll record as paid with transaction details.
 */
const markPayrollPaid = async (paymentId, { paidDate, paymentMode, referenceNo, notes }, recordedBy) => {
  const payment = await StaffPayment.findOne({ _id: paymentId, isDeleted: false });
  if (!payment) throw new ApiError(httpStatus.NOT_FOUND, "Payroll record not found");
  if (payment.status === "paid") {
    throw new ApiError(httpStatus.BAD_REQUEST, "This payroll is already marked as paid");
  }

  payment.status = "paid";
  payment.paidDate = paidDate || new Date();
  payment.paymentMode = paymentMode || null;
  payment.referenceNo = referenceNo || null;
  payment.notes = notes || null;
  payment.recordedBy = recordedBy;

  await payment.save();
  return payment.populate([
    { path: "employeeId", populate: { path: "userId", select: "name email role picture" } },
    { path: "pgId", select: "name" },
  ]);
};

module.exports = { generatePayroll, getPayrolls, markPayrollPaid };
