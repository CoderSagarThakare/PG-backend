const mongoose = require("mongoose");
const { private } = require("./plugins");
const { SCHEMA_NAME, PG_TYPES, OCCUPANCY_TYPES } = require("../const/constant");

const postSchema = mongoose.Schema(
  {
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
    address: {
      pincode: { type: Number, required: true, index: true },
      city: { type: String, required: true, trim: true },
    },
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [0, 0] },
    },
    occupancyType: {
      type: String,
      enum: [
        OCCUPANCY_TYPES.single,
        OCCUPANCY_TYPES.double,
        OCCUPANCY_TYPES.triple,
        OCCUPANCY_TYPES.four,
        OCCUPANCY_TYPES.other,
      ],
      required: true,
    },
    pgType: {
      type: String,
      required: true,
      enum: [
        PG_TYPES.male,
        PG_TYPES.female,
        PG_TYPES.unisex,
        PG_TYPES.coLiving,
      ],
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
    facilities: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: SCHEMA_NAME.facilities,
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: SCHEMA_NAME.staff,
      required: true,
      immutable: true,
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
postSchema.plugin(private);
postSchema.index({ location: "2dsphere" });

// Sirf wahi records dikhao jo deleted nahi hain
// Agar query mein manually 'isDeleted' nahi bheja gaya, toh default false set karo
postSchema.pre(/^find/, function (next) {
  if (this.getQuery().isDeleted === undefined) {
    this.where({ isDeleted: false });
  }
  next();
});

/**
 * @typedef Post
 */
const Post = mongoose.model(SCHEMA_NAME.post, postSchema);
module.exports = Post;
