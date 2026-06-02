const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const sendResponse = require("../utils/sendResponse");
const expenseService = require("../services/expense.service");
const { PG } = require("../models");

const getAccessiblePgIds = async (userId) => {
  const pgs = await PG.find({
    $or: [{ ownerId: userId }, { managerId: userId }],
    isDeleted: false,
  }, "_id");
  return pgs.map(p => String(p._id));
};

const createExpense = catchAsync(async (req, res) => {
  const expense = await expenseService.createExpense(req.body, req.user._id);
  sendResponse(res, { data: expense, statusCode: httpStatus.CREATED, message: "Expense claim submitted" });
});

const getExpenses = catchAsync(async (req, res) => {
  const query = { ...req.query };

  // Employees can only ever see their own expense claims
  if (req.user.role === 'employee') {
    query.spentBy = String(req.user._id);
  } else {
    const pgIds = await getAccessiblePgIds(req.user._id);
    if (query.pgId) {
      if (!pgIds.includes(String(query.pgId))) {
        return sendResponse(res, { data: { expenses: [], total: 0, page: 1, limit: 20 }, statusCode: httpStatus.OK });
      }
    } else {
      query.pgId = { $in: pgIds };
    }
  }

  const result = await expenseService.getExpenses(query);
  sendResponse(res, { data: result, statusCode: httpStatus.OK });
});

const processExpense = catchAsync(async (req, res) => {
  const { action, reimbursementType, rejectionReason } = req.body;
  const expense = await expenseService.processExpense(
    req.params.id,
    action,
    req.user._id,
    { reimbursementType, rejectionReason }
  );
  sendResponse(res, { data: expense, message: `Expense ${action}d successfully` });
});

const markExpensePaid = catchAsync(async (req, res) => {
  const expense = await expenseService.markExpensePaid(req.params.id);
  sendResponse(res, { data: expense, message: "Expense marked as paid" });
});

const deleteExpense = catchAsync(async (req, res) => {
  await expenseService.deleteExpense(req.params.id, req.user._id);
  sendResponse(res, { message: "Expense claim deleted" });
});

module.exports = { createExpense, getExpenses, processExpense, markExpensePaid, deleteExpense };
