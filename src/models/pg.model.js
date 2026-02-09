const mongoose = require("mongoose");
const { private } = require("./plugins");

const pgSchema = mongoose.Schema(
  {
    ownerId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      pincode: {
        type: Number,
        required: true,
      },
      locationDescription: {
        type: String,
        trim: true,
      },
      landmark: {
        type: String,
        required: true,
        trim: true,
      },
      city: {
        type: String,
        required: true,
        trim: true,
      },
      state: {
        type: String,
        required: true,
        trim: true,
      },
      country: {
        type: String,
        required: true,
        trim: true,
      },
    },
    totalRooms: {
      type: Number,
      required: true,
      validate(value) {
        if (value < 1) {
          throw new Error("Total rooms must be at least 1");
        }
      },
    },
    totalBeds: {
      type: Number,
      required: true,
      validate(value) {
        if (value < 1) {
          throw new Error("Total beds must be at least 1");
        }
      },
    },
    description: {
      type: String,
      trim: true,
      default: "A comfortable and secure PG stay with all essential amenities, ideal for students and working professionals. Enjoy a clean, peaceful, and convenient living experience.",
    },
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

/**
 * @typedef PG
 */
const PG = mongoose.model("PG", pgSchema);

pgSchema.plugin(private);

module.exports = PG;
