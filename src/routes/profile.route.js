const express = require("express");
const router = express.Router();
const { staffController } = require("../controllers");
const validate = require("../middlewares/validate");
const { staffValidation } = require("../validations");

// Staff profile routes
router
  .route("/")
  .get(staffController.getStaff)
  .patch(validate(staffValidation.updateStaff), staffController.updateStaff)
  .delete(staffController.deleteStaff);

module.exports = router;
