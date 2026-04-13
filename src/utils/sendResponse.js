/**
 * Send a standardized JSON response.
 * @param {import('express').Response} res
 * @param {Object} options
 * @param {boolean} [options.success=true]
 * @param {string} [options.message='Success']
 * @param {Object|Array|null} [options.data=null]
 * @param {number} [options.statusCode=200]
 */
const sendResponse = (res, { success = true, message = "Success", data = null, statusCode = 200 } = {}) => {
  return res.status(statusCode).json({
    success,
    message,
    data,
  });
};

module.exports = sendResponse;
