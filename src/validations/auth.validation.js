const Joi = require("joi");
const { password } = require("./custom.validation");
const { ROLE_TYPES } = require("../const/constant");
const mobileRegex = /^[6-9]\d{9}$/;

const register = {
  body: Joi.object().keys({
    name: Joi.string().required(),
    email: Joi.string().required().email(),
    password: Joi.string().required().custom(password),
    mobNo1: Joi.string().required().pattern(mobileRegex).messages({
      "string.pattern.base":
        "Primary mobile number must be a valid 10-digit Indian number.",
      "any.required": "Primary mobile number is mandatory.",
    }),
    role: Joi.string()
      .required()
      .valid(
        ROLE_TYPES.user,
        ROLE_TYPES.owner,
        ROLE_TYPES.admin,
        ROLE_TYPES.manager,
        ROLE_TYPES.employee,
      )
      .messages({
        "any.only":
          "Role must be one of [owner, user, admin, manager, employee]",
      }),
  }),
};

const login = {
  body: Joi.object().keys({
    email: Joi.string().required().email(),
    password: Joi.string().required(),
  }),
};

const socialLogin = {
  body: Joi.object().keys({
    token: Joi.string().required(),
  }),
};

const forgotPassword = {
  body: Joi.object().keys({
    email: Joi.string().email().required(),
  }),
};

const resetPassword = {
  query: Joi.object().keys({
    token: Joi.string().required(),
  }),
  body: Joi.object().keys({
    password: Joi.string().required().custom(password),
  }),
};

const verifyEmail = {
  query: Joi.object().keys({
    token: Joi.string().required(),
  }),
};

const verifyOTP = {
  body: Joi.object().keys({
    otp: Joi.number().required(),
  }),
};
module.exports = {
  register,
  login,
  socialLogin,
  forgotPassword,
  resetPassword,
  verifyEmail,
  verifyOTP,
};
