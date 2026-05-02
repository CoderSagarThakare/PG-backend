const mongoose = require("mongoose");
const { private } = require("./plugins");
const { SCHEMA_NAME } = require("../const/constant");

const roomSchema = mongoose.Schema(
  {
    pgId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: SCHEMA_NAME.pg,
      required: true,
    },
    roomNumber: {
      type: String,
      required: true,
      trim: true,
    },
    floor: {
      type: Number,
      required: true,
    },
    sharingType: {
      type: Number, // 1, 2, 3, etc.
      required: true,
      min: 1,
    },
    roomType: {
      type: String,
      enum: ["AC", "Non-AC"],
      default: "Non-AC",
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

roomSchema.plugin(private);

const Room = mongoose.model(SCHEMA_NAME.room, roomSchema);

module.exports = Room;
