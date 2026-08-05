const Joi = require('joi');
const { objectId } = require('./custom.validation');

const createPreBooking = {
  body: Joi.object().keys({
    pgId: Joi.string().custom(objectId).required(),
    roomId: Joi.string().custom(objectId).required(),
    bedId: Joi.string().custom(objectId).required(),
    userId: Joi.string().custom(objectId).allow(null, ''),
    guestDetails: Joi.object().keys({
      name: Joi.string().trim().required(),
      phone: Joi.string().trim().required(),
      email: Joi.string().email().allow('', null).trim(),
    }).required(),
    expectedMoveInDate: Joi.date().iso().required(),
    advanceAmount: Joi.number().min(0).required(),
    isRefundable: Joi.boolean().default(true),
    paymentMode: Joi.string().valid('cash', 'upi', 'bank_transfer', 'online'),
    paymentReference: Joi.string().trim().allow(''),
    paymentDate: Joi.date().iso(),
  }),
};

const cancelPreBooking = {
  params: Joi.object().keys({ id: Joi.string().custom(objectId).required() }),
  body: Joi.object().keys({
    reason: Joi.string().trim().allow(''),
    refundStatus: Joi.string().valid('refunded', 'forfeited').required(),
    refundReference: Joi.string().trim().allow(''),
  }),
};

const getPreBookingsByPg = {
  params: Joi.object().keys({ pgId: Joi.string().custom(objectId).required() }),
  query: Joi.object().keys({
    status: Joi.string().valid('reserved', 'onboarded', 'cancelled', 'all'),
  }),
};

const getPreBookingByBed = {
  params: Joi.object().keys({ bedId: Joi.string().custom(objectId).required() }),
};

const setVacatingNotice = {
  body: Joi.object().keys({
    bedId: Joi.string().custom(objectId).required(),
    vacatingDate: Joi.date().iso().required(),
    reason: Joi.string().trim().allow(''),
  }),
};

const clearVacatingNotice = {
  params: Joi.object().keys({ bedId: Joi.string().custom(objectId).required() }),
};

module.exports = {
  createPreBooking,
  cancelPreBooking,
  getPreBookingsByPg,
  getPreBookingByBed,
  setVacatingNotice,
  clearVacatingNotice,
};
