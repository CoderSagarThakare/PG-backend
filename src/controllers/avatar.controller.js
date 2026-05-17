const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const sendResponse = require("../utils/sendResponse");
const { awsService } = require("../services");
const { User } = require("../models");

/**
 * GET /user/profile/avatar/upload-url?fileName=xxx&fileType=image/jpeg
 * Returns a presigned S3 URL so the client can upload directly.
 */
const getAvatarUploadUrl = catchAsync(async (req, res) => {
  const { fileName, fileType } = req.query;
  if (!fileName || !fileType) {
    return res.status(httpStatus.BAD_REQUEST).json({ message: "fileName and fileType are required" });
  }

  const { uploadUrl, key } = await awsService.getAvatarUploadUrl(fileName, fileType);
  sendResponse(res, { data: { uploadUrl, key }, statusCode: httpStatus.OK });
});

/**
 * PATCH /user/profile/avatar
 * Body: { key } — the S3 key after client-side upload
 * Saves key to DB, returns a fresh presigned view URL.
 */
const saveAvatar = catchAsync(async (req, res) => {
  const { key } = req.body;
  if (!key) {
    return res.status(httpStatus.BAD_REQUEST).json({ message: "key is required" });
  }

  const user = await User.findById(req.user.id);
  const viewUrl = await awsService.saveAvatarKey(user, key, user.profileImageKey);

  sendResponse(res, {
    data: { picture: viewUrl, key },
    message: "Avatar updated successfully",
    statusCode: httpStatus.OK,
  });
});

/**
 * DELETE /user/profile/avatar
 * Deletes custom avatar from S3 and reverts to default.
 */
const deleteAvatar = catchAsync(async (req, res) => {
  const user = await User.findById(req.user.id);
  await awsService.deleteAvatar(user);

  sendResponse(res, {
    data: { picture: user.picture },
    message: "Avatar removed, reverted to default",
    statusCode: httpStatus.OK,
  });
});

/**
 * GET /user/profile/avatar
 * Returns the current avatar view URL (refreshed presigned URL or default).
 */
const getAvatarUrl = catchAsync(async (req, res) => {
  const user = await User.findById(req.user.id).select("picture profileImageKey");
  let picture = user.picture;

  if (user.profileImageKey) {
    picture = await awsService.getFileUrl(user.profileImageKey);
  }

  sendResponse(res, { data: { picture }, statusCode: httpStatus.OK });
});

module.exports = { getAvatarUploadUrl, saveAvatar, deleteAvatar, getAvatarUrl };
