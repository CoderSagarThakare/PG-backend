const logger = require("../config/logger");
const { authController } = require("../controllers");
const auth = require("../middlewares/auth");
const captcha = require("../middlewares/captcha");
const validate = require("../middlewares/validate");
const { authValidation } = require("../validations");

const router = require("express").Router();

router.get("/", (req, res) => {
  res.send("hiii in auth /");
});

router.post(
  "/register",
  // [captcha.verify, validate(authValidation.register)],
  [validate(authValidation.register)],
  authController.register
);

router.post(
  "/login",
  [captcha.verify, validate(authValidation.login)],
  authController.login
);

router.post(
  "/login/:provider",
  [captcha.verify, validate(authValidation.socialLogin)],
  authController.socialLogin
);

router.post(
  "/forgot-password",
  [captcha.verify, validate(authValidation.forgotPassword)],
  authController.forgotPassword
);

router.post(
  "/reset-password",
  validate(authValidation.resetPassword),
  authController.resetPassword
);

router.post(
  "/send-verification-email",
  [auth()],
  authController.sendVerificationEmail
);

router.post(
  "/verify-email",
  validate(authValidation.verifyEmail),
  authController.verifyEmail
);

router.get(
  "/send-verification-otp",
  auth(),
  authController.sendVerificationOTP
);

router.post(
  "/verify-otp",
  [validate(authValidation.verifyOTP), auth()],
  authController.verifyOTP
);

module.exports = router;
