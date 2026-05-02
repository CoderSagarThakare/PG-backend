const catchAsync = require("../utils/catchAsync");
const { facilitiesService } = require("../services");
const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const { PG } = require("../models");
const sendResponse = require("../utils/sendResponse");

const getAllFacilities = catchAsync(async (req, res) => {
  const facilities = await facilitiesService.getAllFacilities();
  sendResponse(res, { data: { facilities }, statusCode: httpStatus.OK });
});

module.exports = {
  getAllFacilities,
};
