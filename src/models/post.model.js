const mongoose = require("mongoose");
const { private } = require("./plugins");
const { SCHEMA_NAME, GENDER_TYPES } = require("../const/constant");

const postSchema = mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: SCHEMA_NAME.staff,
      required: true,
    },
    pgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: SCHEMA_NAME.pg,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxLength: 100,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    vacancyCount: {
      type: Number,
      required: true,
      min: 0,
    },
    gender: {
      type: String,
      required: true,
      enum: [GENDER_TYPES.male, GENDER_TYPES.female, GENDER_TYPES.unisex],
    },
    pricePerBed: {
      type: Number,
      required: true,
      min: 0,
    },
    availableFrom: {
      type: Date,
      default: Date.now,
    },
    images: [
      {
        type: String,
        trim: true,
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// Plugin to hide private fields (like __v) if you're using it
postSchema.plugin(private);

/**
 * @typedef Post
 */
const Post = mongoose.model(SCHEMA_NAME.post, postSchema);

module.exports = Post;
