const mongoose = require("mongoose");
const { private } = require("./plugins");
const { SCHEMA_NAME } = require("../const/constant");

const bedSchema = mongoose.Schema(
  {
    roomId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: SCHEMA_NAME.room,
      required: true,
    },
    pgId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: SCHEMA_NAME.pg,
      required: true,
    },
    bedNumber: {
      type: String, // e.g., "101-A", "101-B"
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    position: {
      type: String, // e.g., "Window Side", "Near Door", "Top Bunk"
      trim: true,
    },
    userId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: SCHEMA_NAME.user,
      default: null,
    },
    status: {
      type: String,
      enum: ["available", "occupied", "maintenance"],
      default: "available",
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

bedSchema.plugin(private);

const Bed = mongoose.model(SCHEMA_NAME.bed, bedSchema);

module.exports = Bed;
