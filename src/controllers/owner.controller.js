const pgController = require("./pg.controller");
const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const { ownerService } = require("../services");
const sendResponse = require("../utils/sendResponse");

const getOwner = catchAsync(async (req, res) => {
  sendResponse(res, { data: req.owner, statusCode: httpStatus.OK });
});

const updateOwner = catchAsync(async (req, res) => {
  await ownerService.updateOwnerById(req.owner._id, req.body);

  sendResponse(res, { success: true, message: "owner modified successfully" });
});

module.exports = {
  createPG: pgController.createPG,
  getPGs: pgController.getPGs,
  getPG: pgController.getPG,
  updatePG: pgController.updatePG,
  deletePG: pgController.deletePG,
  getOwner,
  updateOwner,
};
