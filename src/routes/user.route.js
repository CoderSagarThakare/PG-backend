const { ROLE_TYPES } = require("../const/constant");
const { userController } = require("../controllers");
const auth = require("../middlewares/auth");
const userPreferenceRoute = require("./userPreference.route");
const router = require("express").Router();

// ── Token authentication for user-only routes below ─────────────────────────
router.use(auth(ROLE_TYPES.user));

router.use("/preference", userPreferenceRoute);

// Admin routes for viewing all users
router.get("/all", auth(ROLE_TYPES.admin, ROLE_TYPES.owner), userController.listUsers);
router.get("/role/:role", auth(ROLE_TYPES.admin, ROLE_TYPES.owner), userController.getUsersByRole);

module.exports = router;

