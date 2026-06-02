const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const sendResponse = require("../utils/sendResponse");
const staffPaymentService = require("../services/staffPayment.service");
const { PG, Employee } = require("../models");

const getAccessiblePgIds = async (userId) => {
  const pgs = await PG.find({
    $or: [{ ownerId: userId }, { managerId: userId }],
    isDeleted: false,
  }, "_id");
  return pgs.map(p => String(p._id));
};

const generatePayroll = catchAsync(async (req, res) => {
  const { employeeId, month } = req.body;
  const payment = await staffPaymentService.generatePayroll(employeeId, month, req.user._id);
  sendResponse(res, { data: payment, statusCode: httpStatus.CREATED, message: "Payroll record generated" });
});

const getPayrolls = catchAsync(async (req, res) => {
  const query = { ...req.query };

  if (req.user.role === 'employee') {
    const employee = await Employee.findOne({ userId: req.user._id, isDeleted: false });
    if (!employee) {
      return sendResponse(res, { data: { payments: [], total: 0, page: 1, limit: 20 }, statusCode: httpStatus.OK });
    }
    query.employeeId = String(employee._id);
  } else {
    const pgIds = await getAccessiblePgIds(req.user._id);
    if (query.pgId) {
      if (!pgIds.includes(String(query.pgId))) {
        return sendResponse(res, { data: { payments: [], total: 0, page: 1, limit: 20 }, statusCode: httpStatus.OK });
      }
    } else {
      query.pgId = { $in: pgIds };
    }
  }

  const result = await staffPaymentService.getPayrolls(query);
  sendResponse(res, { data: result, statusCode: httpStatus.OK });
});

const markPayrollPaid = catchAsync(async (req, res) => {
  const payment = await staffPaymentService.markPayrollPaid(req.params.id, req.body, req.user._id);
  sendResponse(res, { data: payment, message: "Payroll marked as paid" });
});

module.exports = { generatePayroll, getPayrolls, markPayrollPaid };
