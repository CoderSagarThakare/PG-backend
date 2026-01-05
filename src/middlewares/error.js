const httpStatus = require("http-status");
const mongoose = require("mongoose");
const ApiError = require("../utils/ApiError");
const config = require("../config/config");
const logger = require("../config/logger");

/**
 * It first checks if the error is an instance of the custom ApiError class.
 * If it's not, it attempts to convert other types of errors to ApiError objects.
 */
const errorConverter = (err, req, res, next) => {
  let error = err;
  logger.info("in error converter");

  // httpStatus.BAD_REQUEST : the server cannot or will not process the request due to something that is perceived to be a client error (for example, malformed request syntax)
  if (!(error instanceof ApiError)) {
    const statusCode =
      error.statusCode || error instanceof mongoose.Error
        ? httpStatus.BAD_REQUEST
        : httpStatus.INTERNAL_SERVER_ERROR;
    const message = error.message || httpStatus[statusCode];
    error = new ApiError(statusCode, message, false, err.stack);
  }
  next(error);
};

const errorHandler = (err, req, res, next) => {
  logger.info("in error handler");
  let { statusCode, message } = err;
  if (config.env === "production" && !err.isOperational) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    message = httpStatus[httpStatus.INTERNAL_SERVER_ERROR];
  }

  res.locals.errorMessage = err.message;

  const response = {
    code: statusCode,
    message,
    ...(config.env === "development" && { stack: err.stack }),
  };

  if (config.env === "development") {
    logger.error("========================", err);  
  }

  res.status(statusCode).send(response);
};

module.exports = { errorConverter, errorHandler };
