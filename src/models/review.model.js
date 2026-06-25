const mongoose = require("mongoose");
const { SCHEMA_NAME } = require("../const/constant");

const reviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: SCHEMA_NAME.user,
      required: true,
    },
    pgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: SCHEMA_NAME.pg,
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      trim: true,
      maxLength: 500,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure a user can only review a specific PG once
reviewSchema.index({ userId: 1, pgId: 1 }, { unique: true });

const Review = mongoose.model(SCHEMA_NAME.review, reviewSchema);

module.exports = Review;
