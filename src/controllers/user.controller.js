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

  let aadharFileUrl = null;
  if (user.aadharFileKey) {
    aadharFileUrl = await awsService.getFileUrl(user.aadharFileKey);
  }

  sendResponse(res, {
    data: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      picture,
      profileImageKey: user.profileImageKey || null,
      aadharNumber: user.aadharNumber || null,
      aadharFileKey: user.aadharFileKey || null,
      aadharFileUrl,
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
  const user = req.user;
  const aadharNumber = req.body.aadharNumber || user.aadharNumber;
  const aadharFileKey = req.body.aadharFileKey || user.aadharFileKey;

  // Aadhaar details are mandatory for all user profile saves
  if (!aadharNumber || !aadharFileKey) {
    return res.status(httpStatus.BAD_REQUEST).json({
      message: "Aadhaar number and Aadhaar card document upload are mandatory.",
    });
  }

  await userService.updateUserById(req.user._id, req.body);
  sendResponse(res, { success: true, message: "user modified successfully" });
});

const getAadharUploadUrl = catchAsync(async (req, res) => {
  const { fileName, fileType } = req.query;
  if (!fileName || !fileType) {
    return res.status(httpStatus.BAD_REQUEST).json({ message: "fileName and fileType are required" });
  }

  const { uploadUrl, key } = await awsService.getAadharUploadUrl(fileName, fileType, req.user);
  sendResponse(res, { data: { uploadUrl, key }, statusCode: httpStatus.OK });
});

const verifyAadharOCR = catchAsync(async (req, res) => {
  const { key } = req.body;
  if (!key) {
    return res.status(httpStatus.BAD_REQUEST).json({ message: "key is required" });
  }

  try {
    const aadharNumber = await awsService.validateAadharImageOCR(key);
    sendResponse(res, {
      data: { aadharNumber },
      message: "Aadhaar card verified successfully",
      statusCode: httpStatus.OK,
    });
  } catch (error) {
    // Instantly delete file from S3 to avoid orphaned waste photos
    await awsService.deleteFile(key).catch(() => {});
    return res.status(error.statusCode || httpStatus.BAD_REQUEST).json({
      message: error.message || "Aadhaar verification failed",
    });
  }
});

const deleteAadharFile = catchAsync(async (req, res) => {
  const { key } = req.body;
  if (!key) {
    return res.status(httpStatus.BAD_REQUEST).json({ message: "key is required" });
  }

  // Security check: only allow deleting keys within user's own kyc folder
  const expectedPrefix = `private/${req.user.role}s/${req.user.role}-${req.user.id || req.user._id}/kyc/`;
  if (!key.startsWith(expectedPrefix)) {
    return res.status(httpStatus.BAD_REQUEST).json({ message: "Invalid key prefix or permission denied" });
  }

  await awsService.deleteFile(key);
  sendResponse(res, { message: "Aadhaar file deleted successfully", statusCode: httpStatus.OK });
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

module.exports = {
  getUser,
  updateUser,
  deleteUser,
  listUsers,
  getUsersByRole,
  getAadharUploadUrl,
  verifyAadharOCR,
  deleteAadharFile,
};
