const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const sendResponse = require('../utils/sendResponse');
const { preBookingService } = require('../services');

const createPreBooking = catchAsync(async (req, res) => {
  const preBooking = await preBookingService.createPreBooking(req.body, req.user._id);
  return sendResponse(res, {
    statusCode: httpStatus.CREATED,
    message: 'Pre-booking created successfully',
    data: preBooking,
  });
});

const cancelPreBooking = catchAsync(async (req, res) => {
  const preBooking = await preBookingService.cancelPreBooking(
    req.params.id,
    req.body,
    req.user._id
  );
  return sendResponse(res, {
    message: 'Pre-booking cancelled successfully',
    data: preBooking,
  });
});

const getPreBookingsByPg = catchAsync(async (req, res) => {
  const preBookings = await preBookingService.getPreBookingsByPg(
    req.params.pgId,
    req.query
  );
  return sendResponse(res, {
    message: 'Pre-bookings fetched successfully',
    data: preBookings,
  });
});

const getPreBookingByBed = catchAsync(async (req, res) => {
  const preBooking = await preBookingService.getPreBookingByBed(req.params.bedId);
  return sendResponse(res, {
    message: preBooking ? 'Pre-booking fetched successfully' : 'No active pre-booking found',
    data: preBooking,
  });
});

const setVacatingNotice = catchAsync(async (req, res) => {
  const bed = await preBookingService.setVacatingNotice(
    req.body.bedId,
    req.body.vacatingDate,
    req.body.reason,
    req.user._id
  );
  return sendResponse(res, {
    message: 'Vacating notice set successfully',
    data: bed,
  });
});

const clearVacatingNotice = catchAsync(async (req, res) => {
  const bed = await preBookingService.clearVacatingNotice(
    req.params.bedId,
    req.user._id
  );
  return sendResponse(res, {
    message: 'Vacating notice cleared successfully',
    data: bed,
  });
});

const getVacatingBeds = catchAsync(async (req, res) => {
  const beds = await preBookingService.getVacatingBeds(req.params.pgId);
  return sendResponse(res, {
    message: 'Vacating beds fetched successfully',
    data: beds,
  });
});

module.exports = {
  createPreBooking,
  cancelPreBooking,
  getPreBookingsByPg,
  getPreBookingByBed,
  setVacatingNotice,
  clearVacatingNotice,
  getVacatingBeds,
};
