const { User, Staff } = require("../models");
const ApiError = require("../utils/ApiError");
const httpStatus = require("http-status");

/**
 * Create User
 * @param {Object} userBody - user information Object
 * @returns {Promise<User>}
 */

const createUser = async (userBody) => {
  const staff = await Staff.findOne({ email: userBody.email });

  if (staff) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "PG Staff already exists with this email",
    );
  }

  // User.isEmailTaken => return true/false
  if (await User.isEmailTaken(userBody.email)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "User already exists with this email",
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
    email
  });
};

const getUserById = (id) => {
  return User.findById(id);
};
// remove fields is boolean value created for delete otp,otpGeneratedTime field from document
// const updateUserById = async (userId, updateBody) => {
//   const user = await getUserById(userId);
//   if (!user) {
//     throw new ApiError(httpStatus.BAD_REQUEST, "User not found");
//   }

//   if (updateBody.email && (await User.isEmailTaken(updateBody.email, userId))) {
//     throw new ApiError(
//       httpStatus.BAD_REQUEST,
//       "User already exists with this email"
//     );
//   }

//   Object.assign(user, updateBody);

//   await user.save();

//   return user;
// };

const updateUserById = async (userId, updateBody) => {
  try {
    if (
      updateBody.email &&
      (await User.isEmailTaken(updateBody.email, userId))
    ) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "User already exists with this email",
      );
    }

    // User will pass only updated data in address
    if (updateBody.address) {
      Object.keys(updateBody.address).forEach((key) => {
        updateBody[`address.${key}`] = updateBody.address[key];
      });
      delete updateBody.address;
    }
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateBody },
      { runValidators: true },
    );

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found");
    }

    return;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to update User",
    );
  }
};

const deleteUserById = async (userId) => {
  try {
    const user = await User.findByIdAndUpdate(userId, { isDeleted: true }, { new: true });
    
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found");
    }

    return;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to delete User",
    );
  }
};

module.exports = {
  createUser,
  getUserByEmail,
  getUserById,
  updateUserById,
  deleteUserById,
};
