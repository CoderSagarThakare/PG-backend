const httpStatus = require('http-status');
const { PreBooking, Bed, PG } = require('../models');
const ApiError = require('../utils/ApiError');
const roomService = require('./room.service');

const createPreBooking = async (data, staffId) => {
  const { pgId, roomId, bedId } = data;

  // Validate bed exists and is available/vacating_soon
  const bed = await Bed.findOne({ _id: bedId, isDeleted: false });
  if (!bed) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Bed not found');
  }
  if (!['available', 'vacating_soon'].includes(bed.status)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Bed is not available for pre-booking');
  }

  // Validate no existing active pre-booking
  const existingPreBooking = await PreBooking.findOne({ bedId, status: 'reserved', isDeleted: false });
  if (existingPreBooking) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Bed is already pre-booked');
  }

  // Validate PG ownership
  const pg = await PG.findOne({ _id: pgId, isDeleted: false });
  if (!pg) {
    throw new ApiError(httpStatus.NOT_FOUND, 'PG not found');
  }
  if (pg.ownerId?.toString() !== staffId.toString() && pg.managerId?.toString() !== staffId.toString()) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Not authorized to manage this PG');
  }

  const preBooking = await PreBooking.create({
    ...data,
    createdBy: staffId,
  });

  bed.status = 'reserved';
  bed.activePreBookingId = preBooking._id;
  await bed.save();

  await roomService.updatePGBedStats(pgId);

  return preBooking;
};

const cancelPreBooking = async (preBookingId, cancelData, staffId) => {
  const preBooking = await PreBooking.findOne({ _id: preBookingId, isDeleted: false });
  if (!preBooking) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Pre-booking not found');
  }
  if (preBooking.status !== 'reserved') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Only reserved pre-bookings can be cancelled');
  }

  // Validate PG ownership
  const pg = await PG.findOne({ _id: preBooking.pgId, isDeleted: false });
  if (pg.ownerId?.toString() !== staffId.toString() && pg.managerId?.toString() !== staffId.toString()) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Not authorized to manage this PG');
  }

  preBooking.cancellationDetails = {
    ...cancelData,
    cancelledAt: new Date(),
    cancelledBy: staffId,
  };
  preBooking.status = 'cancelled';
  await preBooking.save();

  // Release bed
  const bed = await Bed.findOne({ _id: preBooking.bedId, isDeleted: false });
  if (bed && bed.activePreBookingId?.toString() === preBookingId.toString()) {
    bed.status = bed.vacatingDetails?.vacatingDate ? 'vacating_soon' : 'available';
    bed.activePreBookingId = null;
    await bed.save();
    await roomService.updatePGBedStats(preBooking.pgId);
  }

  return preBooking;
};

const getPreBookingsByPg = async (pgId, filters) => {
  const query = { pgId, isDeleted: false };
  if (filters.status && filters.status !== 'all') {
    query.status = filters.status;
  }

  return PreBooking.find(query)
    .populate('userId', 'name email mobNo1')
    .populate('bedId', 'bedNumber price')
    .populate('roomId', 'roomNumber floor')
    .sort({ createdAt: -1 });
};

const getPreBookingByBed = async (bedId) => {
  return PreBooking.findOne({ bedId, status: 'reserved', isDeleted: false })
    .populate('userId', 'name email mobNo1')
    .populate('guestDetails');
};

const setVacatingNotice = async (bedId, vacatingDate, reason, staffId) => {
  const bed = await Bed.findOne({ _id: bedId, isDeleted: false });
  if (!bed) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Bed not found');
  }
  if (!['occupied', 'reserved'].includes(bed.status) || (bed.status === 'reserved' && !bed.userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Bed does not have an active occupant to set vacating notice');
  }

  // Validate PG ownership
  const pg = await PG.findOne({ _id: bed.pgId, isDeleted: false });
  if (pg.ownerId?.toString() !== staffId.toString() && pg.managerId?.toString() !== staffId.toString()) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Not authorized to manage this PG');
  }

  if (bed.status === 'occupied') {
    bed.status = 'vacating_soon';
  }
  bed.vacatingDetails = {
    vacatingDate,
    noticeGivenAt: new Date(),
    reason,
  };
  await bed.save();

  await roomService.updatePGBedStats(bed.pgId);

  return bed;
};

const clearVacatingNotice = async (bedId, staffId) => {
  const bed = await Bed.findOne({ _id: bedId, isDeleted: false });
  if (!bed) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Bed not found');
  }
  if (!['vacating_soon', 'reserved'].includes(bed.status) || !bed.vacatingDetails?.vacatingDate) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Bed does not have an active vacating notice');
  }

  // Validate PG ownership
  const pg = await PG.findOne({ _id: bed.pgId, isDeleted: false });
  if (pg.ownerId?.toString() !== staffId.toString() && pg.managerId?.toString() !== staffId.toString()) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Not authorized to manage this PG');
  }

  if (bed.status === 'vacating_soon') {
    bed.status = 'occupied';
  }
  bed.vacatingDetails = undefined;
  await bed.save();

  await roomService.updatePGBedStats(bed.pgId);

  return bed;
};

const getVacatingBeds = async (pgId) => {
  return Bed.find({
    pgId,
    isDeleted: false,
    $or: [
      { status: 'vacating_soon' },
      { 'vacatingDetails.vacatingDate': { $ne: null } }
    ]
  })
    .populate('userId', 'name email mobNo1')
    .populate('roomId', 'roomNumber floor')
    .populate('activePreBookingId');
};

module.exports = {
  createPreBooking,
  cancelPreBooking,
  getPreBookingsByPg,
  getPreBookingByBed,
  setVacatingNotice,
  clearVacatingNotice,
  getVacatingBeds,
};
