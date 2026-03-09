const Joi = require("joi");

const updateStaff = {
  body: Joi.object()
    .keys({
      name: Joi.string(),
      email: Joi.string().email(),
      password: Joi.string()
        .min(8)
        .pattern(/\d/)
        .pattern(/[a-zA-Z]/)
        .messages({
          "string.pattern.base":
            "Password must contain at least one letter and one number",
        }),
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
      picture: Joi.string().uri().optional(),
      isEmailVerified: Joi.boolean(),
      isPasswordUpdated: Joi.boolean(),
    })
    .min(1),
};

module.exports = {
  updateStaff,
};
