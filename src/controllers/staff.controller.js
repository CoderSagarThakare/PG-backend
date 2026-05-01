const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const { staffService } = require("../services");
const sendResponse = require("../utils/sendResponse");

/**
 * Get current staff member details
 */
const getStaff = catchAsync(async (req, res) => {
  req.user.otp = undefined;
  sendResponse(res, { data: req.user, statusCode: httpStatus.OK });
});

/**
 * Update current staff member
 */
const updateStaff = catchAsync(async (req, res) => {
  await staffService.updateStaffById(req.user._id, req.body);

  sendResponse(res, { success: true, message: "staff modified successfully" });
});

/**
 * Get all staff members (Admin only)
 */
const getAllStaff = catchAsync(async (req, res) => {
  const options = {
    limit: req.query.limit ? parseInt(req.query.limit) : 10,
    page: req.query.page ? parseInt(req.query.page) : 1,
  };

  const result = await staffService.getAllStaff(options);
  sendResponse(res, { data: result, statusCode: httpStatus.OK });
});

/**
 * Get staff by role (Admin only)
 */
const getStaffByRole = catchAsync(async (req, res) => {
  const role = req.params.role;
  const options = {
    limit: req.query.limit ? parseInt(req.query.limit) : 10,
    page: req.query.page ? parseInt(req.query.page) : 1,
  };

  const result = await staffService.getStaffByRole(role, options);
  sendResponse(res, { data: result, statusCode: httpStatus.OK });
});

const deleteStaff = catchAsync(async (req, res) => {
  await staffService.deleteStaffById(req.user._id);
  sendResponse(res, { success: true, message: "staff deleted successfully", statusCode: httpStatus.OK });
});

/**
 * Get all managers (Owner only)
 */
const getManagers = catchAsync(async (req, res) => {
  const options = {
    limit: req.query.limit ? parseInt(req.query.limit) : 10,
    page: req.query.page ? parseInt(req.query.page) : 1,
  };

  const result = await staffService.getManagersList(options, req.user._id);
  sendResponse(res, { data: result, statusCode: httpStatus.OK });
});

module.exports = { getStaff, updateStaff, getAllStaff, getStaffByRole, deleteStaff, getManagers };
