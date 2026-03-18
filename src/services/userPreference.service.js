const { UserPreference } = require("../models");
const ApiError = require("../utils/ApiError");
const httpStatus = require("http-status");

const getPreferenceByUserId = async (userId, preferenceId) => {
  const pref = await UserPreference.findOne({
    _id: preferenceId,
    userId,
    isDeleted: false,
  });


  if (!pref) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      "Preference not found or it'sdeleted",
    );
  }

  return pref;
};

/**
 * Create new preference
 */
const createPreference = async (userId, prefBody) => {
  await UserPreference.create({
    ...prefBody,
    userId,
  });

  return;
};

/**
 * Update existing active preference
 */
const updatePreference = async (userId, preferenceId, updateBody) => {
  const pref = await UserPreference.findOneAndUpdate(
    { _id: preferenceId, userId, isDeleted: false },
    updateBody,
  );

  if (!pref) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      "Preference not found or its deleted",
    );
  }
  return;
};

/**
 * Separate Delete function (if needed later)
 */
const deletePreference = async (userId) => {
  const pref = await updatePreference(userId, {
    isDeleted: true,
    isActive: false,
  });
  return pref;
};

module.exports = {
  getPreferenceByUserId,
  createPreference,
  updatePreference,
  deletePreference,
};
