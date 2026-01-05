const httpStatus = require("http-status");
const axios = require("axios");
const ApiError = require("../utils/ApiError");
const config = require("../config/config");
const catchAsync = require("../utils/catchAsync");

// Captcha verification middleware
const verifyCaptcha = catchAsync(async (req, res, next) => {
  if (req.query.captcha !== "false") {
    try {
      const captcha = req.body.captcha;
      delete req.body.captcha;
      if (!captcha) {
        throw new Error("Error: captcha required");
      }
      const url = `https://www.google.com/recaptcha/api/siteverify?response=${captcha}&secret=${config.reCaptcha.secret}`;
      const options = {
        url: url,
        method: "POST",
        headers: {
          "Content-type": "application/json",
        },
      };
      const { data } = await axios(options);

      if ((data.success && data.score > 0.5) || req.query.ignoreCaptcha) {
        next();
      } else {
        throw new ApiError(
          httpStatus.UNAUTHORIZED,
          "ReCaptcha verification failed. Please try again."
        );
      }
    } catch (error) {
      throw new ApiError(
        httpStatus.UNPROCESSABLE_ENTITY, // UNPROCESSABLE_ENTITY : 422
        error.message || error
      );
    }
  } else {
    next();
  }
});

module.exports = {
  verify: verifyCaptcha,
};
