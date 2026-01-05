const { User } = require("../models");
const ApiError = require("../utils/ApiError");
const httpStatus = require("http-status");

/**
 * Create User
 * @param {Object} userBody - user information Object
 * @returns {Promise<User>}
 */

const createUser = async (userBody) => {
  // User.isEmailTaken => return true/false
  if (await User.isEmailTaken(userBody.email)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "User already exists with this email"
    );
  }

  return User.create(userBody);
};

/**
 * Get user by email
 * @param {string} email
 * @returns {Promise<User>}
 */
const getUserByEmail = async (email) => {
  return User.findOne({
    email,
  });
};

const getUserById = (id) => {
  return User.findById(id);
};
// remove fields is boolean value created for delete otp,otpGeneratedTime field from document
const updateUserById = async (userId, updateBody) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.BAD_REQUEST, "User not found");
  }
  if (updateBody.email && (await User.isEmailTaken(updateBody.email, userId))) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "User already exists with this email"
    );
  }

  Object.assign(user, updateBody);

  await user.save();

  return user;
};

module.exports = {
  createUser,
  getUserByEmail,
  getUserById,
  updateUserById,
};
