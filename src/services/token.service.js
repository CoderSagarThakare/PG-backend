const moment = require("moment");
const config = require("../config/config");
const { tokenTypes } = require("../config/token");
const httpStatus = require("http-status");
const { userService } = require(".");
const ApiError = require("../utils/ApiError");
const jwt = require("jsonwebtoken");

/**
 * Generate auth tokens
 * @param {User} user
 * @returns {Promise<Object>}
 */
const generateAuthTokens = async (user) => {
  const accessTokenExpires = moment().add(
    config.jwt.accessExpirationMinutes,
    "minutes"
  );

  const accessToken = generateToken(
    user._id,
    accessTokenExpires,
    tokenTypes.ACCESS
  );

  return {
    token: accessToken,
    expires: accessTokenExpires.toDate(),
  };
};

/**
 * Generate token
 * @param {ObjectId} userId
 * @param {Moment} expires
 * @param {string} type
 * @param {string} [secret]
 * @returns {string}
 */

/**
 * The moment.unix() function in the context of the moment library is used to
 * convert a Unix timestamp (seconds since the Unix epoch) into a moment object.
 */
const generateToken = (userId, expires, type, secret = config.jwt.secret) => {
  const payload = {
    sub: userId,
    iat: moment().unix(), //iat : Issued At
    exp: expires.unix(), //exp : Expiration Time
    type,
  };

  return jwt.sign(payload, secret);
};

/**
 *
 * @param {string} email
 *
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
  generateAuthTokens,
  generateResetPassword,
  verifyToken,
  generateVerifyEmailToken,
};
