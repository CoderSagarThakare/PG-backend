const passport = require("passport");
const ApiError = require("../utils/ApiError");
const httpStatus = require("http-status");

const auth =
  (...requiredRights) =>
  async (req, res, next) => {
    return new Promise((resolve, reject) => {
      passport.authenticate(
        "jwt",
        {
          session: false,
        },
        verifyCallBack(req, resolve, reject, requiredRights)
      )(req, res, next);
    })
      .then(() => {
        next();
      })
      .catch((err) => {
        next(err);
      });
  };

const verifyCallBack = (req, resolve, reject, requiredRights) => {

  // err, user, info this data coming from jwtVerify() => done(null,user)
  return async (err, user, info) => {
    if (err || info || !user) {
      return reject(
        new ApiError(httpStatus.UNAUTHORIZED, "please authenticate")
      );
    }

    //Reject user if user is deleted
    if (user.deleted) {
      return reject(new ApiError(httpStatus.UNAUTHORIZED, "User deleted"));
    }

    console.log("Authenticated user:", user);
    console.log( !requiredRights.includes(user.role.toLowerCase()), "Required rights:", requiredRights, "User role:", user.role.toLowerCase());

    // Check if requiredRights is provided and validate user role
    if (requiredRights.length > 0 && !requiredRights.includes(user.role.toLowerCase())) {
      return reject(
        new ApiError(httpStatus.FORBIDDEN, "Access denied: Insufficient permissions")
      );
    }

    req.user = user;

    resolve();
  };
};

module.exports = auth;
