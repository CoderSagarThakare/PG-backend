/**
 * It is designed for handling API-related errors & includes properties for the HTTP status code, a message, and operational status.
 * It can be used to create custom error objects with these properties when dealing with API requests and responses.
 */

//Error is Interface
class ApiError extends Error {
  constructor(statusCode, message, isOperational = true, stack = "") {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

module.exports = ApiError;
