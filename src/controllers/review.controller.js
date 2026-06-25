const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const { reviewService } = require("../services");
const sendResponse = require("../utils/sendResponse");

const createOrUpdateReview = catchAsync(async (req, res) => {
  const { pgId, rating, comment } = req.body;
  const review = await reviewService.createOrUpdateReview(
    req.user._id,
    pgId,
    rating,
    comment
  );
  sendResponse(res, {
    success: true,
    message: "Review submitted successfully",
    data: review,
    statusCode: httpStatus.OK,
  });
});

const getPGReviews = catchAsync(async (req, res) => {
  const { pgId } = req.params;
  const { page, limit } = req.query;
  const result = await reviewService.getPGReviews(pgId, { page, limit });
  sendResponse(res, {
    success: true,
    data: result,
    statusCode: httpStatus.OK,
  });
});

const getMyReview = catchAsync(async (req, res) => {
  const { pgId } = req.params;
  const review = await reviewService.getMyReview(req.user._id, pgId);
  const isEligible = await reviewService.checkUserEligibility(req.user._id, pgId);
  sendResponse(res, {
    success: true,
    data: {
      review,
      isEligible,
    },
    statusCode: httpStatus.OK,
  });
});

const deleteReview = catchAsync(async (req, res) => {
  const { reviewId } = req.params;
  await reviewService.deleteReview(req.user._id, reviewId);
  sendResponse(res, {
    success: true,
    message: "Review deleted successfully",
    statusCode: httpStatus.OK,
  });
});

module.exports = {
  createOrUpdateReview,
  getPGReviews,
  getMyReview,
  deleteReview,
};
