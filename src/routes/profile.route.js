const express = require("express");
const router = express.Router();
const { userController, avatarController } = require("../controllers");
const auth = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const { userValidation } = require("../validations");
const { ROLE_TYPES } = require("../const/constant");

const allRoles = auth(
  ROLE_TYPES.user,
  ROLE_TYPES.owner,
  ROLE_TYPES.manager,
  ROLE_TYPES.employee,
  ROLE_TYPES.admin
);

// Avatar routes
router.get("/avatar/upload-url", allRoles, avatarController.getAvatarUploadUrl);
router.get("/avatar", allRoles, avatarController.getAvatarUrl);
router.patch("/avatar", allRoles, avatarController.saveAvatar);
router.delete("/avatar", allRoles, avatarController.deleteAvatar);

// Aadhaar routes
router.get("/aadhar/upload-url", allRoles, userController.getAadharUploadUrl);
router.post("/aadhar/verify", allRoles, userController.verifyAadharOCR);
router.delete("/aadhar", allRoles, userController.deleteAadharFile);

// Profile CRUD
router
  .route("/")
  .get(allRoles, userController.getUser)
  .patch(allRoles, validate(userValidation.updateUser), userController.updateUser)
  .delete(allRoles, userController.deleteUser);

module.exports = router;
