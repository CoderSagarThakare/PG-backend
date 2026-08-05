const mongoose = require("mongoose");
const { private } = require("./plugins");
const { SCHEMA_NAME } = require("../const/constant");

const preBookingSchema = mongoose.Schema(
  {
    pgId: { type: mongoose.SchemaTypes.ObjectId, ref: SCHEMA_NAME.pg, required: true },
    roomId: { type: mongoose.SchemaTypes.ObjectId, ref: SCHEMA_NAME.room, required: true },
    bedId: { type: mongoose.SchemaTypes.ObjectId, ref: SCHEMA_NAME.bed, required: true },
    userId: { type: mongoose.SchemaTypes.ObjectId, ref: SCHEMA_NAME.user, default: null },
    guestDetails: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
      email: { type: String, lowercase: true, trim: true },
    },
    expectedMoveInDate: { type: Date, required: true },
    advanceAmount: { type: Number, required: true, min: 0 },
    isRefundable: { type: Boolean, default: true },
    paymentMode: { type: String, enum: ['cash', 'upi', 'bank_transfer', 'online'], default: 'cash' },
    paymentReference: { type: String, trim: true },
    paymentDate: { type: Date, default: Date.now },
    status: { type: String, enum: ['reserved', 'onboarded', 'cancelled'], default: 'reserved' },
    cancellationDetails: {
      cancelledAt: Date,
      cancelledBy: { type: mongoose.SchemaTypes.ObjectId, ref: SCHEMA_NAME.user },
      reason: { type: String, trim: true },
      refundStatus: { type: String, enum: ['not_applicable', 'refunded', 'forfeited'], default: 'not_applicable' },
      refundReference: { type: String, trim: true },
    },
    createdBy: { type: mongoose.SchemaTypes.ObjectId, ref: SCHEMA_NAME.user, required: true },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

preBookingSchema.index({ pgId: 1, status: 1 });
preBookingSchema.index({ bedId: 1, status: 1 });

preBookingSchema.pre("find", function () {
  this.where({ isDeleted: false });
});

preBookingSchema.pre("findOne", function () {
  this.where({ isDeleted: false });
});

preBookingSchema.plugin(private);

const PreBooking = mongoose.model(SCHEMA_NAME.preBooking, preBookingSchema);

module.exports = PreBooking;
