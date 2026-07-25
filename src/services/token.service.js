const moment = require("moment");
const config = require("../config/config");
const { tokenTypes } = require("../config/token");
const httpStatus = require("http-status");
const userService = require("./user.service");
const ApiError = require("../utils/ApiError");
const jwt = require("jsonwebtoken");
const { Token } = require("../models");

/**
 * Generate token
 * @param {ObjectId} userId
 * @param {Moment} expires
 * @param {string} type
 * @param {string} [secret]
 * @returns {string}
 */
const generateToken = (userId, expires, type, secret = config.jwt.secret) => {
  const payload = {
    sub: userId,
    iat: moment().unix(),
    exp: expires.unix(),
    type,
  };

  return jwt.sign(payload, secret);
};

/**
 * Save a refresh token document to the database
 * @param {string} token
 * @param {ObjectId} userId
 * @param {Moment} expires
 * @param {string} type
 * @param {boolean} [blacklisted]
 * @returns {Promise<Token>}
 */
const saveToken = async (token, userId, expires, type, blacklisted = false) => {
  const tokenDoc = await Token.create({
    token,
    user: userId,
    expires: expires.toDate(),
    type,
    blacklisted,
  });
  return tokenDoc;
};

/**
 * Generate auth tokens (short-lived access + long-lived refresh)
 * @param {User} user
 * @returns {Promise<Object>}
 */
const generateAuthTokens = async (user) => {
  // Short-lived access token (15 min default)
  const accessTokenExpires = moment().add(
    config.jwt.accessExpirationMinutes,
    "minutes"
  );
  const accessToken = generateToken(
    user._id,
    accessTokenExpires,
    tokenTypes.ACCESS
  );

  // Long-lived refresh token (7 days default)
  const refreshTokenExpires = moment().add(
    config.jwt.refreshExpirationDays,
    "days"
  );
  const refreshToken = generateToken(
    user._id,
    refreshTokenExpires,
    tokenTypes.REFRESH
  );

  // Persist refresh token in DB for revocation support
  await saveToken(refreshToken, user._id, refreshTokenExpires, tokenTypes.REFRESH);

  return {
    access: {
      token: accessToken,
      expires: accessTokenExpires.toDate(),
    },
    refresh: {
      token: refreshToken,
      expires: refreshTokenExpires.toDate(),
    },
  };
};

/**
 * Verify a refresh token and return its DB document
 * @param {string} refreshToken
 * @returns {Promise<Token>}
 */
const verifyRefreshToken = async (refreshToken) => {
  const payload = verifyTokenPayload(refreshToken);

  if (payload.type !== tokenTypes.REFRESH) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid token type");
  }

  const tokenDoc = await Token.findOne({
    token: refreshToken,
    type: tokenTypes.REFRESH,
    user: payload.sub,
    blacklisted: false,
  });

  if (!tokenDoc) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Refresh token not found or revoked");
  }

  return tokenDoc;
};

/**
 * Verify JWT payload (used internally)
 * @param {string} token
 * @returns {Object} payload
 */
const verifyTokenPayload = (token) => {
  try {
    const payload = jwt.verify(token, config.jwt.secret);
    return payload;
  } catch (e) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid Token");
  }
};

/**
 * Generate reset password token
 * @param {string} email
 * @returns {Promise<string>}
 */
const generateResetPassword = async (email) => {
  const user = await userService.getUserByEmail(email);
  if (!user)
    throw new ApiError(
      httpStatus.NOT_FOUND,
      "No user found with given mail-id"
    );

  const expires = moment().add(
    config.jwt.resetPasswordExpirationMinutes,
    "minutes"
  );
  const resetPasswordToken = generateToken(
    user._id,
    expires,
    tokenTypes.RESET_PASSWORD
  );
  return resetPasswordToken;
};

/**
 * Verify any token (access, reset-password, verify-email)
 * @param {string} token
 * @param {string} type
 * @returns {Promise<Object>} payload
 */
const verifyToken = async (token, type) => {
  try {
    const payload = jwt.verify(token, config.jwt.secret);
    return payload;
  } catch (e) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid Token");
  }
};

const generateVerifyEmailToken = async (user) => {
  const expires = moment().add(
    config.jwt.verifyEmailExpirationMinutes,
    "minutes"
  );
  const verifyEmailToken = generateToken(
    user.id,
    expires,
    tokenTypes.VERIFY_EMAIL
  );
  return verifyEmailToken;
};

module.exports = {
  generateToken,
  saveToken,
  generateAuthTokens,
  verifyRefreshToken,
  verifyTokenPayload,
  generateResetPassword,
  verifyToken,
  generateVerifyEmailToken,
};
