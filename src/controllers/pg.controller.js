const catchAsync = require("../utils/catchAsync");
const { ownerService } = require("../services");
const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const { PG } = require("../models");

const createPG = catchAsync(async (req, res) => {
  const pgData = {
    ...req.body,
    ownerId: req.user.id,
  };

  const existingPG = await PG.findOne({
    ownerId: pgData.ownerId,
    name: pgData.name,
  });

  if (existingPG) {
    throw new ApiError(
      httpStatus.CONFLICT,
      "You already have a PG with this name",
    );
  }
  await ownerService.createPG(pgData);

  res
    .status(httpStatus.CREATED)
    .json({ success: true, message: "PG created successfully" });
});

const getPGs = catchAsync(async (req, res) => {
  const options = {
    limit: req.query.limit,
    page: req.query.page,
    sortBy: req.query.sortBy,
  };

  const isAdmin = req.user.role === "admin" || req.user.isAdmin === true;
  const result = await ownerService.getPGsByOwner(req.user.id, options, isAdmin);

  res.status(httpStatus.OK).json(result);
});

const getPG = catchAsync(async (req, res) => {
  const isAdmin = req.user.role === "admin" || req.user.isAdmin === true;
  const pg = await ownerService.getPGById(req.params.pgId, req.user.id, isAdmin);

  res.status(httpStatus.OK).json({ pg });
});

const updatePG = catchAsync(async (req, res) => {
  await ownerService.updatePG(req.params.pgId, req.user.id, req.body);

  res
    .status(httpStatus.OK)
    .json({ success: true, message: "PG updated successfully" });
});

const deletePG = catchAsync(async (req, res) => {
  await ownerService.deletePG(req.params.pgId, req.user.id);

  res.status(httpStatus.OK).json({ message: "PG deleted successfully" });
});

module.exports = {
  createPG,
  getPGs,
  getPG,
  updatePG,
  deletePG,
};
