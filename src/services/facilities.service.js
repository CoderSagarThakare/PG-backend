const { Facilities } = require("../models");
const ApiError = require("../utils/ApiError");
const httpStatus = require("http-status");

const getAllFacilities = async () => {
  try {
    const facilities = await Facilities.find();
    return facilities;
  } catch (error) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to retrieve facilities",
    );
  }
};

module.exports = {
  getAllFacilities,
};
