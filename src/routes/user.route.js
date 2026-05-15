const { ROLE_TYPES } = require("../const/constant");
const { userController } = require("../controllers");
const auth = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const { userValidation } = require("../validations");
const userPreferenceRoute = require("./userPreference.route");
const router = require("express").Router();

// Token authentication for all routes defined in this file
router.use(auth(ROLE_TYPES.user));

router.use("/preference", userPreferenceRoute);

// get update user
router
  .route("/profile")
  .get(userController.getUser)
  .patch(validate(userValidation.updateUser), userController.updateUser)
  .delete(userController.deleteUser);

// Admin routes for viewing all users
router.get("/all", auth(ROLE_TYPES.admin, ROLE_TYPES.owner), userController.listUsers);
router.get("/role/:role", auth(ROLE_TYPES.admin, ROLE_TYPES.owner), userController.getUsersByRole);

module.exports = router;
