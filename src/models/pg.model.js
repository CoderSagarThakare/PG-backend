const mongoose = require("mongoose");
const { private } = require("./plugins");
const { SCHEMA_NAME, PG_TYPES } = require("../const/constant");

const pgSchema = mongoose.Schema(
  {
    ownerId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: SCHEMA_NAME.user,
      required: true,
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: SCHEMA_NAME.user,
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
    // geolocation point for the PG (longitude, latitude)
    location: {
      type: {
        type: String,
        enum: ["Point"],
      },
      coordinates: {
        type: [Number],
      },
    },
    pgType: {
      type: String,
      enum: [
        PG_TYPES.male,
        PG_TYPES.female,
        PG_TYPES.unisex,
        PG_TYPES.coLiving,
      ],
    },
    totalRooms: {
      type: Number,
      default: 0,
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
      set: (v) => Math.round(v * 10) / 10,
    },
    totalBeds: {
      type: Number,
      default: 0,
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
    dueDayOfMonth: {
      type: Number,
      default: 10,
      min: 1,
      max: 28,
    },
    lateFee: {
      type: Number,
      default: 0,
      min: 0,
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

// Pre-save hook to ensure PG name consistency (Title Case and Trimming)
pgSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.name = this.name
      .trim()
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }
  next();
});

// Enables high-performance geospatial queries like "find PGs near me" (within X km radius)
pgSchema.index({ location: "2dsphere" });

pgSchema.plugin(private);

/**
 * @typedef PG
 */
const PG = mongoose.model(SCHEMA_NAME.pg, pgSchema);

module.exports = PG;
