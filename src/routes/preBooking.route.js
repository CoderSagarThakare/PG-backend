const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { preBookingController } = require('../controllers');
const { preBookingValidation } = require('../validations');

router.post(
  '/',
  auth('owner', 'manager'),
  validate(preBookingValidation.createPreBooking),
  preBookingController.createPreBooking
);

router.post(
  '/:id/cancel',
  auth('owner', 'manager'),
  validate(preBookingValidation.cancelPreBooking),
  preBookingController.cancelPreBooking
);

router.get(
  '/pg/:pgId',
  auth('owner', 'manager'),
  validate(preBookingValidation.getPreBookingsByPg),
  preBookingController.getPreBookingsByPg
);

router.get(
  '/bed/:bedId',
  auth('owner', 'manager'),
  validate(preBookingValidation.getPreBookingByBed),
  preBookingController.getPreBookingByBed
);

router.post(
  '/vacating-notice',
  auth('owner', 'manager'),
  validate(preBookingValidation.setVacatingNotice),
  preBookingController.setVacatingNotice
);

router.delete(
  '/vacating-notice/:bedId',
  auth('owner', 'manager'),
  validate(preBookingValidation.clearVacatingNotice),
  preBookingController.clearVacatingNotice
);

router.get(
  '/vacating/:pgId',
  auth('owner', 'manager'),
  preBookingController.getVacatingBeds
);

module.exports = router;
