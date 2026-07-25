const rateLimit = require("express-rate-limit");

const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20, // Limit each IP to 20 requests per `window` (here, per 10 minutes).,
  message: "two many request check express-rate-limit",
  skipSuccessfulRequests: true, // Don't count successful requests
});

module.exports = authLimiter;

// check remaning request count in postman header section
