const mongoose = require("mongoose");
const { Review, PG, Bed, RentPayment } = require("../models");
const ApiError = require("../utils/ApiError");
const httpStatus = require("http-status");

/**
 * Recalculate average rating and update PG document
 * @param {string} pgId
 */
const updatePGAverageRating = async (pgId) => {
  const stats = await Review.aggregate([
    { $match: { pgId: new mongoose.Types.ObjectId(pgId) } },
    {
      $group: {
        _id: "$pgId",
        numReviews: { $sum: 1 },
        avgRating: { $avg: "$rating" },
      },
    },
  ]);

  if (stats.length > 0) {
    await PG.findByIdAndUpdate(pgId, {
      rating: parseFloat(stats[0].avgRating.toFixed(1)),
      numReviews: stats[0].numReviews,
    });
  } else {
    await PG.findByIdAndUpdate(pgId, {
      rating: 0,
      numReviews: 0,
    });
  }
};

/**
 * Check if user is eligible to rate a PG (current or past tenant)
 * @param {string} userId
 * @param {string} pgId
 * @returns {Promise<boolean>}
 */
const checkUserEligibility = async (userId, pgId) => {
  // Check if user currently occupies a bed in this PG
  const currentBed = await Bed.findOne({ userId, pgId, isDeleted: false });
  if (currentBed) return true;

  // Check if user has rent records in this PG (past tenant)
  const hasRentHistory = await RentPayment.findOne({ userId, pgId, isDeleted: false });
  if (hasRentHistory) return true;

  return false;
};

/**
 * Create or update a review
 * @param {string} userId
 * @param {string} pgId
 * @param {number} rating
 * @param {string} comment
 * @returns {Promise<object>}
 */
const createOrUpdateReview = async (userId, pgId, rating, comment) => {
  const pgExists = await PG.findOne({ _id: pgId, isDeleted: false });
  if (!pgExists) {
    throw new ApiError(httpStatus.NOT_FOUND, "PG not found");
  }

  const isEligible = await checkUserEligibility(userId, pgId);
  if (!isEligible) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Only verified residents (current or past tenants) can rate this property"
    );
  }

  const review = await Review.findOneAndUpdate(
    { userId, pgId },
    { rating, comment },
    { upsert: true, new: true, runValidators: true }
  );

  await updatePGAverageRating(pgId);

  return review;
};

/**
 * Get reviews for a PG with pagination
 * @param {string} pgId
 * @param {object} options
 * @returns {Promise<object>}
 */
const getPGReviews = async (pgId, options = {}) => {
  const limit = parseInt(options.limit, 10) || 10;
  const page = parseInt(options.page, 10) || 1;
  const skip = (page - 1) * limit;

  const reviews = await Review.find({ pgId })
    .populate("userId", "name avatar profilePicture")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Review.countDocuments({ pgId });

  return {
    reviews,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    totalReviews: total,
  };
};

/**
 * Get active user's review for a specific PG
 * @param {string} userId
 * @param {string} pgId
 * @returns {Promise<object|null>}
 */
const getMyReview = async (userId, pgId) => {
  return Review.findOne({ userId, pgId });
};

/**
 * Delete a review
 * @param {string} userId
 * @param {string} reviewId
 */
const deleteReview = async (userId, reviewId) => {
  const review = await Review.findById(reviewId);
  if (!review) {
    throw new ApiError(httpStatus.NOT_FOUND, "Review not found");
  }

  if (review.userId.toString() !== userId.toString()) {
    throw new ApiError(httpStatus.FORBIDDEN, "You can only delete your own review");
  }

  await review.deleteOne();
  await updatePGAverageRating(review.pgId);
};

module.exports = {
  createOrUpdateReview,
  getPGReviews,
  getMyReview,
  deleteReview,
  checkUserEligibility,
};
