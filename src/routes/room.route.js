const express = require('express');
const auth = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const roomValidation = require('../validations/room.validation');
const roomController = require('../controllers/room.controller');

const router = express.Router();

router
  .route('/')
  .post(auth('owner', 'manager'), validate(roomValidation.createRoom), roomController.createRoom);

router
  .route('/pg/:pgId')
  .get(auth('owner', 'manager'), validate(roomValidation.getRooms), roomController.getRooms);

router
  .route('/:roomId')
  .patch(auth('owner', 'manager'), validate(roomValidation.updateRoom), roomController.updateRoom)
  .delete(auth('owner', 'manager'), roomController.deleteRoom);

router
  .route('/eligible-tenants/:pgId')
  .get(auth('owner', 'manager'), roomController.getEligibleTenants);

router
  .route('/assign/:bedId')
  .post(auth('owner', 'manager'), validate(roomValidation.assignTenant), roomController.assignTenant);

router
  .route('/unassign/:bedId')
  .post(auth('owner', 'manager'), roomController.unassignTenant);

router
  .route('/bed/:bedId')
  .patch(auth('owner', 'manager'), validate(roomValidation.updateBed), roomController.updateBed);

module.exports = router;
