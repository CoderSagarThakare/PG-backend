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
  const pg = await PgService.getPGById(req.params.pgId, req.user.id, isAdmin);

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

module.exports = {
  createPG,
  getPGs,
  getPG,
  updatePG,
  deletePG,
};
