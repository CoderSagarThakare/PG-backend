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

// ------------------  MIDDLEWARES  ----------------------------

// JSON requests are received as plain text. We need to parse the json request body.
app.use(bodyParser.json());

// Parse urlencoded request body if provided with any of the requests
app.use(express.urlencoded({ extended: true }));

// Initialize jwt authentication
app.use(passport.initialize());

// Define jwt token authentication strategy
passport.use('jwt', jwtStrategy); 

// Enable cors to accept requests from any frontend domain,
app.use(cors());

// Limit repeated failed requests to auth endpoints/routes
if (config.env == "production") {
  app.use("/auth", authLimiter);
}

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
