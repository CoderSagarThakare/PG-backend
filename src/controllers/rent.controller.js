const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const sendResponse = require("../utils/sendResponse");
const rentService = require("../services/rent.service");

const recordPayment = catchAsync(async (req, res) => {
  const rent = await rentService.recordPayment(req.body, req.user._id);
  sendResponse(res, { data: rent, statusCode: httpStatus.CREATED, message: "Payment recorded" });
});

const getRentPayments = catchAsync(async (req, res) => {
  const result = await rentService.getRentPayments(req.query);
  sendResponse(res, { data: result, statusCode: httpStatus.OK });
});

const getMonthlySummary = catchAsync(async (req, res) => {
  const { pgId, rentMonth } = req.query;
  const summary = await rentService.getMonthlySummary(pgId, rentMonth);
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


