const express = require("express");
const app = express();
const cors = require("cors");
const bodyParser = require("body-parser");
const routes = require("./routes");
const config = require("./config/config");
const authLimiter = require("./middlewares/rateLimiter");
const ApiError = require("./utils/ApiError");
const httpStatus = require("http-status");
const passport = require('passport')
const { errorConverter, errorHandler } = require("./middlewares/error");
const { jwtStrategy } = require("./config/passport");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./config/swagger.json");

// ------------------  MIDDLEWARES  ----------------------------

// Disable ETag to prevent 304 Not Modified caching issues
// app.set('etag', false);

// JSON requests are received as plain text. We need to parse the json request body.
// Trust first proxy (Render, Railway, Nginx, etc.) so req.ip returns the real client IP.
// Without this, express-rate-limit sees the proxy's IP for ALL users → global block instead of per-user.
app.set('trust proxy', 1);

// Enable cors to accept requests from any frontend domain
app.use(cors());

// JSON requests are received as plain text. We need to parse the json request body.
app.use(bodyParser.json({ strict: false }));

// Normalize parsed body to prevent errors on null or non-object payloads
app.use((req, res, next) => {
  if (req.body === null || typeof req.body !== "object") {
    req.body = {};
  }
  next();
});

// Parse urlencoded request body if provided with any of the requests
app.use(express.urlencoded({ extended: true }));

// Initialize jwt authentication
app.use(passport.initialize());

// Define jwt token authentication strategy
passport.use('jwt', jwtStrategy); 

// Limit repeated failed requests to auth endpoints/routes
if (config.env == "production") {
  app.use("/auth", authLimiter);
}

// Serve interactive API documentation (Swagger UI)
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Define routes index in separate file.
app.use("/", routes);

// Send back a 404 error for any unknown api request
app.use('*',(req, res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, `${req.baseUrl} URL NOT FOUND `));
});
    
// Convert error to ApiError, if request was rejected or it throws an error
app.use(errorConverter);

// Handle the error
app.use(errorHandler);

module.exports = app;
