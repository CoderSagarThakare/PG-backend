const { Owner } = require("../models");
const ApiError = require("../utils/ApiError");
const httpStatus = require("http-status");

/**
 * Create Owner
 * @param {Object} ownerBody - owner information Object
 * @returns {Promise<Owner>}
 */

const createOwner = async (ownerBody) => {
  // Owner.isEmailTaken => return true/false
  if (await Owner.isEmailTaken(ownerBody.email)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Owner already exists with this email"
    );
  }

  return Owner.create(ownerBody);
};

/**
 * Get owner by email
 * @param {string} email
 * @returns {Promise<Owner>}
 */
const getOwnerByEmail = async (email) => {
  return Owner.findOne({
    email,
  });
};

const getOwnerById = (id) => {
  return Owner.findById(id);
};
// remove fields is boolean value created for delete otp,otpGeneratedTime field from document
const updateOwnerById = async (userId, updateBody) => {
  const owner = await getOwnerById(userId);
  if (!owner) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Owner not found");
  }
  if (updateBody.email && (await Owner.isEmailTaken(updateBody.email, userId))) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Owner already exists with this email"
    );
  }

  Object.assign(owner, updateBody);

  await owner.save();

  return owner;
};

module.exports = {
  createOwner,
  getOwnerByEmail,
  getOwnerById,
  updateOwnerById,
};
