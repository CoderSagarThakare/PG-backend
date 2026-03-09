const mongoose = require("mongoose");
const { SCHEMA_NAME } = require("../const/constant");

const facilitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true, // Removes accidental spaces like " Study table "
      unique: true,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  },
);

// Create the model
const Facilities = mongoose.model(SCHEMA_NAME.facilities, facilitySchema);

module.exports = Facilities;
