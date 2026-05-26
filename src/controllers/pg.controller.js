const catchAsync = require("../utils/catchAsync");
const { PgService } = require("../services");
const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const sendResponse = require("../utils/sendResponse");

const createPG = catchAsync(async (req, res) => {
  const pgData = {
    ...req.body,
    ownerId: req.user.id,
  };

  await PgService.checkExistingPG(pgData.ownerId, pgData.name);
  await PgService.createPG(pgData);

  sendResponse(res, { success: true, message: "PG created successfully", statusCode: httpStatus.CREATED });
});

const getPGs = catchAsync(async (req, res) => {
  const options = {
    limit: req.query.limit,
    page: req.query.page,
    sortBy: req.query.sortBy,
  };

  const isAdmin = req.user.role === "admin";
  const result = await PgService.getPGsByOwner(req.user.id, options, isAdmin);

  sendResponse(res, { data: result, statusCode: httpStatus.OK });
});

const getPG = catchAsync(async (req, res) => {
  const isAdmin = req.user.role === "admin";
  const pg = await PgService.getPGById(req.params.pgId, req.user, isAdmin);

  sendResponse(res, { data: { pg }, statusCode: httpStatus.OK });
});

const updatePG = catchAsync(async (req, res) => {
  await PgService.updatePG(req.params.pgId, req.user.id, req.body);

  sendResponse(res, { success: true, message: "PG updated successfully", statusCode: httpStatus.OK });
});

const deletePG = catchAsync(async (req, res) => {
  await PgService.deletePG(req.params.pgId, req.user.id);

  sendResponse(res, { success: true, message: "PG deleted successfully", statusCode: httpStatus.OK });
});

const discoverPGs = catchAsync(async (req, res) => {
  const filter = {
    city: req.query.city,
    pgType: req.query.pgType,
    facilities: req.query.facilities ? req.query.facilities.split(',') : [],
  };
  const options = {
    limit: parseInt(req.query.limit) || 9,
    page: parseInt(req.query.page) || 1,
  };

  const result = await PgService.discoverPGs(filter, options);
  sendResponse(res, { data: result, statusCode: httpStatus.OK });
});

const getPriceRange = catchAsync(async (req, res) => {
  const result = await PgService.getPriceRange(req.params.pgId);
  sendResponse(res, { data: result, statusCode: httpStatus.OK });
});

const getPGImageUploadUrl = catchAsync(async (req, res) => {
  const { fileName, fileType } = req.query;
  if (!fileName || !fileType) {
    return res.status(httpStatus.BAD_REQUEST).json({ message: "fileName and fileType are required" });
  }

  const { awsService } = require("../services");
  const { uploadUrl, key } = await awsService.getPGShowcaseUploadUrl(fileName, fileType);
  sendResponse(res, { data: { uploadUrl, key }, statusCode: httpStatus.OK });
});

const deletePGImageFile = catchAsync(async (req, res) => {
  const { key } = req.body;
  if (!key) {
    return res.status(httpStatus.BAD_REQUEST).json({ message: "key is required" });
  }

  // Security check: only allow deleting files under public/pgs/
  if (!key.startsWith("public/pgs/")) {
    return res.status(httpStatus.BAD_REQUEST).json({ message: "Invalid key prefix or permission denied" });
  }

  const { awsService } = require("../services");
  await awsService.deleteFile(key);
  sendResponse(res, { success: true, message: "File deleted successfully from S3", statusCode: httpStatus.OK });
});

module.exports = {
  createPG,
  getPGs,
  getPG,
  updatePG,
  deletePG,
  discoverPGs,
  getPriceRange,
  getPGImageUploadUrl,
  deletePGImageFile,
};

