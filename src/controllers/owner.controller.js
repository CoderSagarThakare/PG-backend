const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const { ownerService } = require("../services");

const getOwner = catchAsync(async (req, res) => {
  res.status(httpStatus.OK).send(req.owner);
});

const updateOwner = catchAsync(async (req, res) => {
  await ownerService.updateOwnerById(req.owner._id, req.body);

  res
    .status(200)
    .send({ success: true, message: "owner modified successfully" });
});

module.exports = { getOwner, updateOwner };
