const mongoose = require("mongoose");
const { SCHEMA_NAME, PG_TYPES } = require("../const/constant");

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
    pgType: {
      type: String,
      enum: [PG_TYPES.male, PG_TYPES.female, PG_TYPES.unisex, PG_TYPES.coLiving],
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
