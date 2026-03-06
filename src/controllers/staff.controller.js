const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const { staffService } = require("../services");

/**
 * Get current staff member details
 */
const getStaff = catchAsync(async (req, res) => {
  req.user.otp = undefined;
  res.status(httpStatus.OK).send(req.user);
});

/**
 * Update current staff member
 */
const updateStaff = catchAsync(async (req, res) => {
  await staffService.updateStaffById(req.user._id, req.body);

  res
    .status(200)
    .send({ success: true, message: "staff modified successfully" });
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
  res.status(httpStatus.OK).send(result);
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
  res.status(httpStatus.OK).send(result);
});

module.exports = { getStaff, updateStaff, getAllStaff, getStaffByRole };
