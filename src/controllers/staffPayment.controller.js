const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const sendResponse = require("../utils/sendResponse");
const staffPaymentService = require("../services/staffPayment.service");
const { PG, Employee, StaffPayment } = require("../models");
const { awsService } = require("../services");

/**
 * Helper: Resolve profile picture signed S3 URL if profileImageKey exists for a payroll record.
 */
const resolvePayrollUserPicture = async (payment) => {
  if (payment && payment.employeeId && payment.employeeId.userId) {
    const user = payment.employeeId.userId;
    if (user.profileImageKey) {
      try {
        user.picture = await awsService.getFileUrl(user.profileImageKey);
      } catch (e) {
        // ignore
      }
    }
  }
};

const getAccessiblePgIds = async (userId) => {
  const pgs = await PG.find({
    $or: [{ ownerId: userId }, { managerId: userId }],
    isDeleted: false,
  }, "_id");
  return pgs.map(p => String(p._id));
};

const generatePayroll = catchAsync(async (req, res) => {
  const { employeeId, month, customSalaries } = req.body;
  const payment = await staffPaymentService.generatePayroll(employeeId, month, req.user._id, customSalaries);
  if (payment) {
    await resolvePayrollUserPicture(payment);
  }
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
  if (result && Array.isArray(result.payments)) {
    for (const p of result.payments) {
      await resolvePayrollUserPicture(p);
    }
  }
  sendResponse(res, { data: result, statusCode: httpStatus.OK });
});

const markPayrollPaid = catchAsync(async (req, res) => {
  // Access control: only owners can pay payroll for manager staff role
  const paymentRecord = await StaffPayment.findById(req.params.id)
    .populate({
      path: "employeeId",
      populate: { path: "userId" }
    });
  if (paymentRecord && paymentRecord.employeeId?.userId?.role === 'manager' && req.user.role !== 'owner') {
    return res.status(httpStatus.FORBIDDEN).json({
      message: "Only owners have permission to mark payroll payouts as paid for managers"
    });
  }

  const payment = await staffPaymentService.markPayrollPaid(req.params.id, req.body, req.user._id);
  if (payment) {
    await resolvePayrollUserPicture(payment);
  }
  sendResponse(res, { data: payment, message: "Payroll marked as paid" });
});

const updatePayroll = catchAsync(async (req, res) => {
  const paymentRecord = await StaffPayment.findById(req.params.id)
    .populate({
      path: "employeeId",
      populate: { path: "userId" }
    });
  if (!paymentRecord) {
    return res.status(httpStatus.NOT_FOUND).json({ message: "Payroll record not found" });
  }

  // Access control: only owners can edit payroll for manager staff role
  if (paymentRecord.employeeId?.userId?.role === 'manager' && req.user.role !== 'owner') {
    return res.status(httpStatus.FORBIDDEN).json({
      message: "Only owners have permission to edit payroll payouts for managers"
    });
  }

  const payment = await staffPaymentService.updatePayroll(req.params.id, req.body);
  if (payment) {
    await resolvePayrollUserPicture(payment);
  }
  sendResponse(res, { data: payment, message: "Payroll record updated successfully" });
});

module.exports = { generatePayroll, getPayrolls, markPayrollPaid, updatePayroll };

