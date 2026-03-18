const mongoose = require("mongoose");
const { SCHEMA_NAME, GENDER_TYPES } = require("../const/constant");

const userPreferenceSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: SCHEMA_NAME.user,
      required: true,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      // stored as [longitude, latitude]
      coordinates: {
        type: [Number],
        default: [0, 0],
      },
      // optional pincode/index for quick queries
    },
    pincode: {
      type: Number,
      index: true,
    },
    city: {
      type: String,
      trim: true,
    },
    budget: {
      min: {
        type: Number,
        default: 0,
      },
      max: {
        type: Number,
      },
    },
    gender: {
      type: String,
      enum: [GENDER_TYPES.male, GENDER_TYPES.female, GENDER_TYPES.unisex],
    },
    facilities: [
      {
        type: mongoose.SchemaTypes.ObjectId,
        ref: SCHEMA_NAME.facilities,
      },
    ],
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// create geospatial index on location
userPreferenceSchema.index({ location: "2dsphere" });

const UserPreference = mongoose.model(
  SCHEMA_NAME.userPreference,
  userPreferenceSchema,
);
module.exports = UserPreference;
