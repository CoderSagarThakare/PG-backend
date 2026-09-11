const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const sendResponse = require("../utils/sendResponse");
const analyticsService = require("../services/analytics.service");

const getOverview = catchAsync(async (req, res) => {
  const data = await analyticsService.getOverviewAnalytics(req.user, req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Analytics overview fetched successfully",
    data,
  });
});

module.exports = {
  getOverview,
};
