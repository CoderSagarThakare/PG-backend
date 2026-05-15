const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const { userService } = require("../services");
const sendResponse = require("../utils/sendResponse");

const getUser = catchAsync(async (req, res) => {
  req.user.otp = undefined;
  sendResponse(res, { data: req.user, statusCode: httpStatus.OK });
});

const updateUser = catchAsync(async (req, res) => {
  await userService.updateUserById(req.user._id, req.body);

  sendResponse(res, { success: true, message: "user modified successfully" });
});

const deleteUser = catchAsync(async (req, res) => {
  await userService.deleteUserById(req.user._id);
  sendResponse(res, { success: true, message: "user deleted successfully" });
});

const listUsers = catchAsync(async (req, res) => {
  const options = {
    limit: req.query.limit,
    page: req.query.page,
  };
  const result = await userService.getAllUsers(options);
  sendResponse(res, { data: result, statusCode: httpStatus.OK });
});

const getUsersByRole = catchAsync(async (req, res) => {
  const { role } = req.params;
  const options = {
    limit: req.query.limit,
    page: req.query.page,
  };
  const result = await userService.getUsersByRole(role, options);
  sendResponse(res, { data: result, statusCode: httpStatus.OK });
});

module.exports = { getUser, updateUser, deleteUser, listUsers, getUsersByRole };
