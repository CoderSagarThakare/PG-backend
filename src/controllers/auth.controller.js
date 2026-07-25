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
const { Token } = require("../models");

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

  const tokens = await tokenService.generateAuthTokens(user);

  // Generate a fresh presigned picture URL if the user has a custom avatar
  let picture = user.picture;
  if (user.profileImageKey) {
    picture = await awsService.getFileUrl(user.profileImageKey);
  }

  sendResponse(res, { 
    success: true, 
    message: "Login successful", 
    data: { 
      token: tokens.access.token,
      refreshToken: tokens.refresh.token,
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
        isEmailVerified: user.isEmailVerified || false,
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
    default:
      throw new ApiError(
        httpStatus.UNPROCESSABLE_ENTITY,
        `Provider ${req.body.provider} is not supported`,
      );
  }
  const tokens = await tokenService.generateAuthTokens(user);
  sendResponse(res, { data: { user, token: tokens.access.token, refreshToken: tokens.refresh.token, expires: tokens.access.expires } });
});

const refreshTokens = catchAsync(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Refresh token is required");
  }

  // 1. Verify & look up the refresh token in DB
  const refreshTokenDoc = await tokenService.verifyRefreshToken(refreshToken);

  // 2. Look up the user
  const user = await userService.getUserById(refreshTokenDoc.user);
  if (!user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "User not found");
  }

  // 3. Delete the old refresh token (rotation: single-use)
  await refreshTokenDoc.deleteOne();

  // 4. Generate new access + refresh tokens
  const tokens = await tokenService.generateAuthTokens(user);

  sendResponse(res, {
    data: {
      token: tokens.access.token,
      refreshToken: tokens.refresh.token,
    },
  });
});

const logoutUser = catchAsync(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Refresh token is required");
  }

  // Remove the refresh token from DB (revoke it)
  const tokenDoc = await Token.findOneAndDelete({ token: refreshToken, type: 'refresh' });
  if (!tokenDoc) {
    throw new ApiError(httpStatus.NOT_FOUND, "Refresh token not found");
  }

  sendResponse(res, { success: true, message: "Logged out successfully" });
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
  refreshTokens,
  logoutUser,
  forgotPassword,
  resetPassword,
  sendVerificationEmail,
  verifyEmail,
  sendVerificationOTP,
  verifyOTP,
};
