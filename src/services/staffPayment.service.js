const mongoose = require("mongoose");
const { StaffPayment, Employee, Expense } = require("../models");
const ApiError = require("../utils/ApiError");
const httpStatus = require("http-status");

/**
 * Generate (or return existing) a payroll record for a staff member for a given month.
 * Automatically sums up approved 'add_to_salary' expenses for that month.
 */
const generatePayroll = async (employeeId, month, recordedBy, customSalaries = null) => {
  const employee = await Employee.findOne({ _id: employeeId, isDeleted: false })
    .populate("userId", "name role");
  if (!employee) throw new ApiError(httpStatus.NOT_FOUND, "Staff record not found");

  const pgsToAllocate = employee.pgIds && employee.pgIds.length > 0 ? employee.pgIds : [null];
  const pgCount = pgsToAllocate.length;

  const [year, monthNum] = month.split("-").map(Number);
  const totalDaysInMonth = new Date(year, monthNum, 0).getDate();
  const monthEnd = new Date(year, monthNum, 0, 23, 59, 59, 999); // last day of month

  // 1. Calculate Proration Ratio based on joinedDate
  let prorationRatio = 1.0;
  if (employee.joinedDate) {
    const joined = new Date(employee.joinedDate);
    const joinedYear = joined.getFullYear();
    const joinedMonth = joined.getMonth() + 1; // 1-indexed

    if (joinedYear > year || (joinedYear === year && joinedMonth > monthNum)) {
      prorationRatio = 0.0; // joined after this month
    } else if (joinedYear === year && joinedMonth === monthNum) {
      // joined during this month: prorate
      const joinDay = joined.getDate();
      const activeDays = (totalDaysInMonth - joinDay) + 1;
      prorationRatio = activeDays / totalDaysInMonth;
    }
  }

  const payments = [];

  // 2. Generate a payroll record per assigned PG
  for (const pgId of pgsToAllocate) {
    const isManualOverride = customSalaries && customSalaries[String(pgId)] !== undefined;
    const customSalary = isManualOverride 
      ? Number(customSalaries[String(pgId)]) 
      : (employee.pgSalaries && employee.pgSalaries.get(String(pgId)) !== undefined
         ? employee.pgSalaries.get(String(pgId))
         : null);

    let salaryPerPg;
    if (customSalary !== null) {
      salaryPerPg = isManualOverride ? customSalary : Math.round(customSalary * prorationRatio);
    } else {
      salaryPerPg = pgCount > 0 ? Math.round((employee.monthlySalary * prorationRatio) / pgCount) : 0;
    }

    // Check if payroll already exists for this month and PG
    const existing = await StaffPayment.findOne({ employeeId, month, pgId, isDeleted: false });
    if (existing) {
      const populated = await existing.populate([
        { path: "employeeId", populate: { path: "userId", select: "name email role picture profileImageKey" } },
        { path: "pgId", select: "name" },
      ]);
      payments.push(populated);
      continue;
    }

    // Sum up approved add_to_salary expenses for this employee in this month FOR THIS PG (including past unpaid expenses)
    const expenses = await Expense.find({
      spentBy: employee.userId._id,
      pgId,
      status: "approved",
      reimbursementType: "add_to_salary",
      payoutStatus: "unpaid",
      spentDate: { $lte: monthEnd },
      isDeleted: false,
    });

    const reimbursedExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalAmount = salaryPerPg + reimbursedExpenses;

    const payment = await StaffPayment.create({
      employeeId,
      pgId,
      month,
      salaryAmount: salaryPerPg,
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

    const populated = await payment.populate([
      { path: "employeeId", populate: { path: "userId", select: "name email role picture profileImageKey" } },
      { path: "pgId", select: "name" },
    ]);
    payments.push(populated);
  }

  return payments[0] || null;
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
        populate: { path: "userId", select: "name email role picture mobNo1 profileImageKey" }
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
    { path: "employeeId", populate: { path: "userId", select: "name email role picture profileImageKey" } },
    { path: "pgId", select: "name" },
  ]);
};

/**
 * Edit a pending payroll record.
 */
const updatePayroll = async (paymentId, { salaryAmount, reimbursedExpenses }) => {
  const payment = await StaffPayment.findOne({ _id: paymentId, isDeleted: false });
  if (!payment) throw new ApiError(httpStatus.NOT_FOUND, "Payroll record not found");
  if (payment.status === "paid") {
    throw new ApiError(httpStatus.BAD_REQUEST, "Cannot edit a paid payroll record");
  }

  if (salaryAmount !== undefined) {
    const sAmt = Number(salaryAmount);
    if (isNaN(sAmt) || sAmt < 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Salary amount must be a non-negative number");
    }
    payment.salaryAmount = sAmt;
  }
  if (reimbursedExpenses !== undefined) {
    const rAmt = Number(reimbursedExpenses);
    if (isNaN(rAmt) || rAmt < 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Reimbursed expenses must be a non-negative number");
    }
    payment.reimbursedExpenses = rAmt;
  }

  payment.totalAmount = payment.salaryAmount + payment.reimbursedExpenses;

  await payment.save();
  return payment.populate([
    { path: "employeeId", populate: { path: "userId", select: "name email role picture profileImageKey" } },
    { path: "pgId", select: "name" },
  ]);
};

module.exports = { generatePayroll, getPayrolls, markPayrollPaid, updatePayroll };

