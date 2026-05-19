const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const sendResponse = require("../utils/sendResponse");
const rentService = require("../services/rent.service");
const { PG } = require("../models");
const ApiError = require("../utils/ApiError");

const recordPayment = catchAsync(async (req, res) => {
  const rent = await rentService.recordPayment(req.body, req.user._id);
  sendResponse(res, { data: rent, statusCode: httpStatus.CREATED, message: "Payment recorded" });
});

const getRentPayments = catchAsync(async (req, res) => {
  // Find all PGs owned or managed by this user
  const userPgs = await PG.find({
    $or: [{ ownerId: req.user._id }, { managerId: req.user._id }],
    isDeleted: false
  }, "_id");
  const pgIds = userPgs.map(p => p._id);

  if (req.query.pgId) {
    if (!pgIds.map(String).includes(String(req.query.pgId))) {
      return sendResponse(res, { data: { records: [], total: 0, page: 1, limit: 20 }, statusCode: httpStatus.OK });
    }
  } else {
    req.query.pgId = { $in: pgIds };
  }

  const result = await rentService.getRentPayments(req.query);
  sendResponse(res, { data: result, statusCode: httpStatus.OK });
});

const getMonthlySummary = catchAsync(async (req, res) => {
  const { pgId, rentMonth } = req.query;

  // Find all PGs owned or managed by this user
  const userPgs = await PG.find({
    $or: [{ ownerId: req.user._id }, { managerId: req.user._id }],
    isDeleted: false
  }, "_id");
  const pgIds = userPgs.map(p => p._id);

  let targetPgId = pgId;
  if (pgId) {
    if (!pgIds.map(String).includes(String(pgId))) {
      return sendResponse(res, { 
        data: { paid: 0, pending: 0, partial: 0, overdue: 0, under_review: 0, totalDue: 0, totalCollected: 0, tenantCount: 0, collectionRate: 0 }, 
        statusCode: httpStatus.OK 
      });
    }
  } else {
    targetPgId = { $in: pgIds };
  }

  const summary = await rentService.getMonthlySummary(targetPgId, rentMonth);
  sendResponse(res, { data: summary, statusCode: httpStatus.OK });
});

const updatePayment = catchAsync(async (req, res) => {
  const { pgId } = req.query;
  const rent = await rentService.updatePayment(req.params.id, req.body, pgId);
  sendResponse(res, { data: rent, message: "Payment updated" });
});

const deletePayment = catchAsync(async (req, res) => {
  const { pgId } = req.query;
  await rentService.deletePayment(req.params.id, pgId);
  sendResponse(res, { message: "Payment record deleted" });
});

const generateMonthlyRent = catchAsync(async (req, res) => {
  const { pgId, rentMonth } = req.body;
  const result = await rentService.generateMonthlyRent(pgId, rentMonth, req.user._id);
  sendResponse(res, { data: result, message: `${result.created} rent records created, ${result.skipped} already existed` });
});

const submitPaymentProof = catchAsync(async (req, res) => {
  const rent = await rentService.submitPaymentProof(req.user._id, req.params.id, req.body);
  sendResponse(res, { data: rent, message: "Payment proof submitted successfully" });
});

const getMyRentPayments = catchAsync(async (req, res) => {
  const result = await rentService.getRentPayments({ ...req.query, userId: req.user._id });
  sendResponse(res, { data: result, statusCode: httpStatus.OK });
});

const approvePayment = catchAsync(async (req, res) => {

  const { pgId } = req.query;
  const rent = await rentService.approvePayment(req.params.id, req.user._id, pgId);
  sendResponse(res, { data: rent, message: "Payment approved successfully" });
});

const rejectPayment = catchAsync(async (req, res) => {
  const { pgId } = req.query;
  const { notes } = req.body;
  const rent = await rentService.rejectPayment(req.params.id, pgId, notes);
  sendResponse(res, { data: rent, message: "Payment rejected" });
});

const bulkApprovePayments = catchAsync(async (req, res) => {
  const { pgId } = req.query;
  const { rentIds } = req.body;
  const result = await rentService.bulkApprovePayments(rentIds, req.user._id, pgId);
  sendResponse(res, { data: result, message: `Approved ${result.approved} payments, failed ${result.failed}` });
});

module.exports = {
  recordPayment,
  getRentPayments,
  getMonthlySummary,
  updatePayment,
  deletePayment,
  generateMonthlyRent,
  submitPaymentProof,
  getMyRentPayments,
  approvePayment,
  rejectPayment,
  bulkApprovePayments,
};


