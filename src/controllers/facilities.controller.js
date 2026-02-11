const catchAsync = require("../utils/catchAsync");
const { facilitiesService } = require("../services");
const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const { PG } = require("../models");

const getAllFacilities = catchAsync(async (req, res) => {
  const isAdmin = req.user.role === "admin" || req.user.isAdmin === true;

  const facilities = await facilitiesService.getAllFacilities();

  res.status(httpStatus.OK).json(facilities);
});

module.exports = {
  getAllFacilities,
};
