const { Expense, User } = require("../models");
const ApiError = require("../utils/ApiError");
const httpStatus = require("http-status");

/**
 * Submit a new expense claim.
 * Can be filed by the employee themselves, or by an owner/manager on behalf of an employee.
 */
const createExpense = async (data, submittedByUserId) => {
  const { spentBy, pgId, amount, description, category, spentDate, photos, reimbursementType } = data;

  if (photos && photos.length > 3) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Maximum 3 receipt photos allowed");
  }

  const expense = await Expense.create({
    spentBy: spentBy || submittedByUserId, // on-behalf: spentBy is explicit; self: same as submittedBy
    submittedBy: submittedByUserId,
    pgId,
    amount,
    description,
    category: category || "General",
    spentDate,
    photos: photos || [],
    reimbursementType: reimbursementType || null,
  });

  return expense.populate([
    { path: "spentBy", select: "name email role picture" },
    { path: "submittedBy", select: "name role" },
    { path: "pgId", select: "name" },
  ]);
};

/**
 * Get paginated expense claims for PGs managed by the user.
 */
const getExpenses = async ({ pgId, spentBy, status, page = 1, limit = 20 }) => {
  const filter = { isDeleted: false };
  if (pgId) filter.pgId = pgId;
  if (spentBy) filter.spentBy = spentBy;
  if (status) filter.status = status;

  const skip = (page - 1) * limit;
  const [expenses, total] = await Promise.all([
    Expense.find(filter)
      .populate({ path: "spentBy", select: "name email role picture" })
      .populate({ path: "submittedBy", select: "name role" })
      .populate({ path: "approvedBy", select: "name role" })
      .populate({ path: "pgId", select: "name" })
      .sort({ spentDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Expense.countDocuments(filter),
  ]);

  return { expenses, total, page: Number(page), limit: Number(limit) };
};

/**
 * Owner/manager approves or rejects an expense claim.
 * On approval, they also set reimbursementType: 'direct' | 'add_to_salary'
 */
const processExpense = async (expenseId, action, actorUserId, { reimbursementType, rejectionReason } = {}) => {
  const expense = await Expense.findOne({ _id: expenseId, isDeleted: false }).populate("spentBy", "role");
  if (!expense) throw new ApiError(httpStatus.NOT_FOUND, "Expense claim not found");
  if (expense.status !== "pending") {
    throw new ApiError(httpStatus.BAD_REQUEST, `Expense is already ${expense.status}`);
  }

  // Fetch actor's role to check permissions
  const actor = await User.findById(actorUserId);
  if (!actor) throw new ApiError(httpStatus.NOT_FOUND, "Approving user not found");

  // Approval Hierarchy: If expense was submitted by a manager, only owners can approve/reject
  if (expense.spentBy?.role === "manager" && actor.role !== "owner") {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Only owners have permission to review expense claims submitted by managers"
    );
  }

  if (action === "approve") {
    if (!reimbursementType || !["direct", "add_to_salary"].includes(reimbursementType)) {
      throw new ApiError(httpStatus.BAD_REQUEST, "reimbursementType must be 'direct' or 'add_to_salary'");
    }
    expense.status = "approved";
    expense.approvedBy = actorUserId;
    expense.approvedAt = new Date();
    expense.reimbursementType = reimbursementType;
    expense.rejectionReason = null;
  } else if (action === "reject") {
    expense.status = "rejected";
    expense.approvedBy = actorUserId;
    expense.approvedAt = new Date();
    expense.rejectionReason = rejectionReason || "No reason provided";
  } else {
    throw new ApiError(httpStatus.BAD_REQUEST, "action must be 'approve' or 'reject'");
  }

  await expense.save();
  return expense.populate([
    { path: "spentBy", select: "name email role picture" },
    { path: "approvedBy", select: "name role" },
    { path: "pgId", select: "name" },
  ]);
};

/**
 * Mark a direct reimbursement expense as paid.
 */
const markExpensePaid = async (expenseId) => {
  const expense = await Expense.findOne({ _id: expenseId, isDeleted: false });
  if (!expense) throw new ApiError(httpStatus.NOT_FOUND, "Expense not found");
  if (expense.status !== "approved") {
    throw new ApiError(httpStatus.BAD_REQUEST, "Expense must be approved before marking as paid");
  }
  if (expense.reimbursementType !== "direct") {
    throw new ApiError(httpStatus.BAD_REQUEST, "Only 'direct' reimbursement expenses can be individually paid");
  }
  expense.payoutStatus = "paid";
  expense.reimbursedDate = new Date();
  await expense.save();
  return expense;
};

/**
 * Soft-delete an expense claim (only if still pending).
 */
const deleteExpense = async (expenseId, requestorId) => {
  const expense = await Expense.findOne({ _id: expenseId, isDeleted: false });
  if (!expense) throw new ApiError(httpStatus.NOT_FOUND, "Expense not found");
  if (expense.status !== "pending") {
    throw new ApiError(httpStatus.BAD_REQUEST, "Cannot delete an expense that has already been processed");
  }
  expense.isDeleted = true;
  await expense.save();
};

module.exports = { createExpense, getExpenses, processExpense, markExpensePaid, deleteExpense };
