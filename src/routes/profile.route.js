const express = require("express");
const router = express.Router();
const { staffController } = require("../controllers");
const validate = require("../middlewares/validate");
const { staffValidation } = require("../validations");

// Staff profile routes
router.get("/", staffController.getStaff);
router.patch(
  "/",
  validate(staffValidation.updateStaff),
  staffController.updateStaff,
);

module.exports = router;
