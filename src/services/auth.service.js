const httpStatus = require("http-status");
const userService = require("./user.service");
const tokenService = require("./token.service");
const ApiError = require("../utils/ApiError");
const { OAuth2Client } = require("google-auth-library");
const config = require("../config/config");
const { tokenTypes } = require("../config/token");

/**
 * Login with username and password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<User>}
 */
const loginUserWithEmailAndPassword = async (email, password) => {
  const user = await userService.getUserByEmail(email);
  if (!user || user.deleted || !(await user.isPasswordMatch(password))) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Incorrect email or password");
  }
  return await user;
};

const loginWithGoogle = async (idToken) => {
  const oAuth2Client = new OAuth2Client(config.socialLogin.google.clientId);

  const ticket = await oAuth2Client.verifyIdToken({
    idToken: idToken,
    audience: config.socialLogin.google.clientId,
  });
  const { email, email_verified, name, picture, iat } = ticket.getPayload();

  if (!email || !email_verified) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Google authentication failed");
  }

  let user = await userService.getUserByEmail(email);

  if (!user || user.deleted) {
    user = await registerUser({
      name,
      email,
      picture,
      password: `${email}${iat}`,
      isPasswordUpdated: false,
    });
  }
  return user;
};

const registerUser = async (userBody) => {
  try {
    const user = await userService.createUser({ ...userBody });

    return user;
  } catch (error) {
    throw error;
  }
};

const resetPassword = async (resetPasswordToken, newPassword) => {
  const payload = await tokenService.verifyToken(
    resetPasswordToken,
    tokenTypes.RESET_PASSWORD
  );

  if (payload.type !== tokenTypes.RESET_PASSWORD) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Please Provide valid Token");
  }

  const user = await userService.getUserById(payload.sub);

  if (!user) {
    throw new ApiError(httpStatus.BAD_REQUEST, "User Not Found");
  }

  await userService.updateUserById(user.id, {
    password: newPassword,
  });
};

const verifyEmail = async (verifyEmailToken) => {
  try {
    const payload = await tokenService.verifyToken(
      verifyEmailToken,
      tokenTypes.VERIFY_EMAIL
    );

    const user = await userService.getUserById(payload.sub);

    if (!user) {
      throw new Error();
    }

    await userService.updateUserById(user.id, {
      isEmailVerified: true,
    });
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Email verification failed");
  }
};
module.exports = {
  loginUserWithEmailAndPassword,
  loginWithGoogle,
  registerUser,
  resetPassword,
  verifyEmail,
};
