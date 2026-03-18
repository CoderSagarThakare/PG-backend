const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const { userPreferenceService } = require("../services");

const getPreference = catchAsync(async (req, res) => {
  const pref = await userPreferenceService.getPreferenceByUserId(
    req.user._id,
    req.params.preferenceId,
  );

  res.status(httpStatus.OK).send(pref);
});

const createPreference = catchAsync(async (req, res) => {
  await userPreferenceService.createPreference(req.user._id, req.body);
  res
    .status(httpStatus.CREATED)
    .send({ status: true, message: "Preference created successfully" });
});

const updatePreference = catchAsync(async (req, res) => {
  await userPreferenceService.updatePreference(
    req.user._id,
    req.params.preferenceId,
    req.body,
  );
  res
    .status(httpStatus.OK)
    .send({ status: true, message: "Preference updated successfully" });
});

const deletePreference = catchAsync(async (req, res) => {
  await userPreferenceService.updatePreference(
    req.user._id,
    req.params.preferenceId,
    { isDeleted: true },
  );
  res
    .status(httpStatus.OK)
    .send({ status: true, message: "Preference deleted successfully" });
});

module.exports = {
  getPreference,
  createPreference,
  updatePreference,
  deletePreference
};
