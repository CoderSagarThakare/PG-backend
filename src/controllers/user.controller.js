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

module.exports = { getUser, updateUser, deleteUser };
