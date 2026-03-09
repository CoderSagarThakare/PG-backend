const mongoose = require("mongoose");
const { private } = require("./plugins");
const { SCHEMA_NAME } = require("../const/constant");

const pgSchema = mongoose.Schema(
  {
    ownerId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: SCHEMA_NAME.staff,
      required: true,
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: SCHEMA_NAME.staff,
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
    description: {
      type: String,
      trim: true,
      default:
        "A comfortable and secure PG stay with all essential amenities, ideal for students and working professionals. Enjoy a clean, peaceful, and convenient living experience.",
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    totalBeds: {
      type: Number,
    },
    occupiedBeds: {
      type: Number,
      default: 0,
    },
    emptyBeds: {
      type: Number,
      default: 0,
    },
    landline: {
      type: String,
      trim: true,
    },
    pgStartedDate: {
      type: Date,
    },
    images: [
      {
        type: String,
        trim: true,
      },
    ],
    locationLink: {
      type: String,
      trim: true,
    },
    checkInTime: {
      type: String,
      trim: true,
    },
    checkOutTime: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    facilities: [
      {
        type: mongoose.Schema.Types.ObjectId,
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

/**
 * @typedef PG
 */
const PG = mongoose.model(SCHEMA_NAME.pg, pgSchema);

pgSchema.plugin(private);

module.exports = PG;
