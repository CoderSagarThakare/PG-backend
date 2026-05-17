const catchAsync = require("../utils/catchAsync");
const {
  tokenService,
  authService,
  emailService,
  otpService,
  userService,
  awsService,
} = require("../services");
const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const { ROLE_TYPES } = require("../const/constant");
const sendResponse = require("../utils/sendResponse");

const register = catchAsync(async (req, res) => {
  const validRoles = [
    ROLE_TYPES.owner,
    ROLE_TYPES.manager,
    ROLE_TYPES.employee,
    ROLE_TYPES.user,
    ROLE_TYPES.admin
  ];

  const role = req.body.role.toLowerCase();

  if (!validRoles.includes(role)) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Invalid role: ${role}`);
  }

  await authService.registerUser({ ...req.body });
  sendResponse(res, { success: true, message: `Registered successfully as ${role}`, statusCode: httpStatus.CREATED });
});

const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  let user = await authService.loginUserWithEmailAndPassword(email, password);

  const token = await tokenService.generateAuthTokens(user);

  // Generate a fresh presigned picture URL if the user has a custom avatar
  let picture = user.picture;
  if (user.profileImageKey) {
    picture = await awsService.getFileUrl(user.profileImageKey);
  }

  sendResponse(res, { 
    success: true, 
    message: "Login successful", 
    data: { 
      token: token.token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        picture,
        profileImageKey: user.profileImageKey || null,
        mobNo1: user.mobNo1,
        mobNo2: user.mobNo2 || null,
        address: user.address,
      }
    } 
  });
});

const socialLogin = catchAsync(async (req, res) => {
  const idToken = req.body.token;
  let user;
  const provider = req.params.provider.toLowerCase();
  switch (provider) {
    case "google":
      user = await authService.loginWithGoogle(idToken);
      break;
    // case "facebook":
    // user = await authService.loginWithFacebook(idToken);
    // break;
    default:
      throw new ApiError(
        httpStatus.UNPROCESSABLE_ENTITY,
        `Provider ${req.body.provider} is not supported`,
      );
  }
  const { token, expires } = await tokenService.generateAuthTokens(user);
  sendResponse(res, { data: { user, token, expires } });
});

const forgotPassword = catchAsync(async (req, res) => {
  const resetPasswordToken = await tokenService.generateResetPassword(
    req.body.email,
  );
  await emailService.sendResetPasswordEmail(req.body.email, resetPasswordToken);
  sendResponse(res, { message: "Email sent successfully" });
});

const resetPassword = catchAsync(async (req, res) => {
  const a = await authService.resetPassword(req.query.token, req.body.password);
  sendResponse(res, { message: "Password reset successfully" });
});

const sendVerificationEmail = catchAsync(async (req, res) => {
  const verifyEmailToken = await tokenService.generateVerifyEmailToken(
    req.user,
  );
  await emailService.sendVerificationEmail(req.user.email, verifyEmailToken);
  sendResponse(res, { message: "verify email sent successfully", statusCode: httpStatus.OK });
});

const verifyEmail = catchAsync(async (req, res) => {
  await authService.verifyEmail(req.query.token);
  sendResponse(res, { message: "e-mail verified successfully", statusCode: httpStatus.OK });
});

const sendVerificationOTP = catchAsync(async (req, res) => {
  const otp = await otpService.sendVerificationOTP(req.user.email);

  await userService.updateUserById(req.user.id, {
    otp: otp,
    otpGeneratedTime: new Date(),
  });

  sendResponse(res, { message: "Check otp on your registered mail-id", statusCode: httpStatus.OK });
});

const verifyOTP = catchAsync(async (req, res) => {
  await otpService.validateOTP(req.user.id, req.body.otp);

  sendResponse(res, { success: true, message: "Email verified successfully !!!", statusCode: httpStatus.OK });
});

module.exports = {
  register,
  login,
  socialLogin,
  forgotPassword,
  resetPassword,
  sendVerificationEmail,
  verifyEmail,
  sendVerificationOTP,
  verifyOTP,
};
