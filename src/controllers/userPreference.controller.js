const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const { userPreferenceService } = require("../services");
const sendResponse = require("../utils/sendResponse");

const getPreference = catchAsync(async (req, res) => {
  const pref = await userPreferenceService.getPreferenceByUserId(
    req.user._id,
    req.params.preferenceId,
  );

  sendResponse(res, { data: pref, statusCode: httpStatus.OK });
});

const createPreference = catchAsync(async (req, res) => {
  await userPreferenceService.createPreference(req.user._id, req.body);
  sendResponse(res, { success: true, message: "Preference created successfully", statusCode: httpStatus.CREATED });
});

const updatePreference = catchAsync(async (req, res) => {
  await userPreferenceService.updatePreference(
    req.user._id,
    req.params.preferenceId,
    req.body,
  );
  sendResponse(res, { success: true, message: "Preference updated successfully", statusCode: httpStatus.OK });
});

const deletePreference = catchAsync(async (req, res) => {
  await userPreferenceService.updatePreference(
    req.user._id,
    req.params.preferenceId,
    { isDeleted: true },
  );
  sendResponse(res, { success: true, message: "Preference deleted successfully", statusCode: httpStatus.OK });
});

module.exports = {
  getPreference,
  createPreference,
  updatePreference,
  deletePreference
};
