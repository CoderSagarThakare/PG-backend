const express = require("express");
const router = express.Router();
const { userController } = require("../controllers");
const auth = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const { userValidation } = require("../validations");
const { ROLE_TYPES } = require("../const/constant");

// Allow any staff role to get/update their profile
const staffRoles = auth(
  ROLE_TYPES.owner,
  ROLE_TYPES.manager,
  ROLE_TYPES.employee,
  ROLE_TYPES.admin
);

router
  .route("/profile")
  .get(staffRoles, userController.getUser)
  .patch(staffRoles, validate(userValidation.updateUser), userController.updateUser);

router.get("/managers", auth(ROLE_TYPES.owner, ROLE_TYPES.manager), userController.getManagersAndOwners);

module.exports = router;
