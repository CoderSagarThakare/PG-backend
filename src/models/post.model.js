const mongoose = require("mongoose");
const { private } = require("./plugins");

const postSchema = mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    pgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pg", // Match this with your PG model name
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
      enum: ["boys", "girls", "unisex"],
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
  }
);

// Plugin to hide private fields (like __v) if you're using it
postSchema.plugin(private);

/**
 * @typedef Post
 */
const Post = mongoose.model("Post", postSchema);

module.exports = Post;