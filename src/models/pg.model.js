const mongoose = require("mongoose");
const validator = require("validator");
const { private } = require("./plugins");

const pgSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    ownerId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: "User",
      required: true,
    },
    address: {
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
    zipCode: {
      type: String,
      required: true,
      trim: true,
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
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * @typedef PG
 */
const PG = mongoose.model("PG", pgSchema);

pgSchema.plugin(private);


module.exports = PG;
