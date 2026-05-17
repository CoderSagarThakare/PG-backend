const { ROLE_TYPES } = require("../const/constant");
const { userController, avatarController } = require("../controllers");
const auth = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const { userValidation } = require("../validations");
const userPreferenceRoute = require("./userPreference.route");
const router = require("express").Router();

// All authenticated roles (every user in the system has a profile)
const allRoles = auth(
  ROLE_TYPES.user,
  ROLE_TYPES.owner,
  ROLE_TYPES.manager,
  ROLE_TYPES.employee,
  ROLE_TYPES.admin
);

// ── Avatar (profile image) CRUD via S3 ──────────────────────────────────────
// These routes must be declared BEFORE the global router.use(auth(user))
// because staff (owner/manager/employee) also need to manage their avatar.
router.get("/profile/avatar/upload-url", allRoles, avatarController.getAvatarUploadUrl);
router.get("/profile/avatar", allRoles, avatarController.getAvatarUrl);
router.patch("/profile/avatar", allRoles, avatarController.saveAvatar);
router.delete("/profile/avatar", allRoles, avatarController.deleteAvatar);

// ── Token authentication for user-only routes below ─────────────────────────
router.use(auth(ROLE_TYPES.user));

router.use("/preference", userPreferenceRoute);

// Get / update / delete user profile
router
  .route("/profile")
  .get(userController.getUser)
  .patch(validate(userValidation.updateUser), userController.updateUser)
  .delete(userController.deleteUser);

// Admin routes for viewing all users
router.get("/all", auth(ROLE_TYPES.admin, ROLE_TYPES.owner), userController.listUsers);
router.get("/role/:role", auth(ROLE_TYPES.admin, ROLE_TYPES.owner), userController.getUsersByRole);

module.exports = router;

