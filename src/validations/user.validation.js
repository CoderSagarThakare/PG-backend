const Joi = require("joi");
const mobileRegex = /^[6-9]\d{9}$/;

const updateUser = {
  body: Joi.object()
    .keys({
      name: Joi.string(),
      email: Joi.string().email(),
      mobNo1: Joi.string().pattern(mobileRegex).messages({
        "string.pattern.base":
          "Primary mobile number must be a valid 10-digit Indian number.",
        "any.required": "Primary mobile number is mandatory.",
      }),
      mobNo2: Joi.string().pattern(mobileRegex).messages({
        "string.pattern.base":
          "Secondary mobile number must be a valid 10-digit Indian number.",
      }),
      password: Joi.string()
        .min(8)
        .pattern(/\d/)
        .pattern(/[a-zA-Z]/)
        .messages({
          "string.pattern.base":
            "Password must contain at least one letter and one number",
        }),
      picture: Joi.string().uri().optional(),
      address: Joi.object()
        .keys({
          pincode: Joi.number(),
          locationDescription: Joi.string().optional(),
          landmark: Joi.string(),
          city: Joi.string(),
          state: Joi.string(),
          country: Joi.string(),
        })
        .min(1),
      isEmailVerified: Joi.boolean(),
      isPasswordUpdated: Joi.boolean(),
    })
    .min(1),
};

module.exports = { updateUser };
