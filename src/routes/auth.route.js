const logger = require("../config/logger");
const { ROLE_TYPES } = require("../const/constant");
const { authController } = require("../controllers");
const auth = require("../middlewares/auth");
const captcha = require("../middlewares/captcha");
const validate = require("../middlewares/validate");
const { authValidation } = require("../validations");
const rateLimit = require("express-rate-limit");

const router = require("express").Router();

// ── Rate limiters ──────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10, // 10 attempts per window
  message: { message: "Too many attempts, please try again after 10 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
});

const strictLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // 5 attempts per window
  message: { message: "Too many attempts, please try again after 10 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get("/", (req, res) => {
  res.send("hiii in auth /");
});

router.post(
  "/register",
  [authLimiter, validate(authValidation.register)],
  authController.register,
);

router.post(
  "/login",
  [authLimiter, validate(authValidation.login)],
  authController.login,
);

router.post(
  "/login/:provider",
  [authLimiter, captcha.verify, validate(authValidation.socialLogin)],
  authController.socialLogin,
);

router.post(
  "/forgot-password",
  [strictLimiter, validate(authValidation.forgotPassword)],
  authController.forgotPassword,
);

router.post(
  "/reset-password",
  [strictLimiter, validate(authValidation.resetPassword)],
  authController.resetPassword,
);

router.post(
  "/send-verification-email",
  [auth(ROLE_TYPES.user, ROLE_TYPES.owner, ROLE_TYPES.admin)],
  authController.sendVerificationEmail,
);

router.post(
  "/verify-email",
  validate(authValidation.verifyEmail),
  authController.verifyEmail,
);

router.get(
  "/send-verification-otp",
  auth(ROLE_TYPES.user, ROLE_TYPES.owner, ROLE_TYPES.admin),
  authController.sendVerificationOTP,
);

router.post(
  "/verify-otp",
  [
    strictLimiter,
    validate(authValidation.verifyOTP),
    auth(ROLE_TYPES.user, ROLE_TYPES.owner, ROLE_TYPES.admin),
  ],
  authController.verifyOTP,
);

// ── Refresh Token Rotation ─────────────────────────────────────────────────────
router.post(
  "/refresh-tokens",
  authController.refreshTokens,
);

// ── Logout (revoke refresh token) ──────────────────────────────────────────────
router.post(
  "/logout",
  authController.logoutUser,
);

module.exports = router;
