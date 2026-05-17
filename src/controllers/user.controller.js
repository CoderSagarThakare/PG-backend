const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const { userService, awsService } = require("../services");
const sendResponse = require("../utils/sendResponse");

const getUser = catchAsync(async (req, res) => {
  const user = req.user;
  user.otp = undefined;

  // Always generate a fresh presigned URL if user has a custom avatar key
  // Presigned URLs expire — this guarantees the client always gets a valid one
  let picture = user.picture;
  if (user.profileImageKey) {
    picture = await awsService.getFileUrl(user.profileImageKey);
  }

  sendResponse(res, {
    data: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      picture,
      profileImageKey: user.profileImageKey || null,
      mobNo1: user.mobNo1,
      mobNo2: user.mobNo2 || null,
      address: user.address,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
    },
    statusCode: httpStatus.OK,
  });
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
