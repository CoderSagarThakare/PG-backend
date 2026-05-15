const express = require("express");
const router = express.Router();
const { userController } = require("../controllers");
const validate = require("../middlewares/validate");
const { userValidation } = require("../validations");

// User profile routes
router
  .route("/")
  .get(userController.getUser)
  .patch(validate(userValidation.updateUser), userController.updateUser)
  .delete(userController.deleteUser);

module.exports = router;
