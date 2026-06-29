const Joi = require("joi");
const { GENDER_TYPES } = require("../const/constant");
const mobileRegex = /^[6-9]\d{9}$/;
const vehicleNoPattern = /^(?:[a-zA-Z]{2}[0-9]{1,2}[a-zA-Z]{1,2}[0-9]{4}|[0-9]{2}BH[0-9]{4}[a-zA-Z]{2})$/;

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
      mobNo2: Joi.string().pattern(mobileRegex).allow("").messages({
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
      aadharNumber: Joi.string().pattern(/^\d{12}$/).allow("", null).optional().messages({
        "string.pattern.base": "Aadhaar number must be a valid 12-digit number.",
      }),
      aadharFileKey: Joi.string().allow("", null).optional(),
      gender: Joi.string()
        .valid(...Object.values(GENDER_TYPES).filter(g => g !== 'unisex'))
        .allow("", null)
        .optional(),
      vehicleType: Joi.string().valid("none", "bike", "car").optional(),
      vehicleNumber: Joi.string()
        .allow("", null)
        .optional()
        .when("vehicleType", {
          is: Joi.string().valid("bike", "car"),
          then: Joi.string().pattern(vehicleNoPattern).required().messages({
            "string.pattern.base": "Please provide a valid Indian vehicle number plate without spaces or hyphens (e.g. MH12AB1234 or 22BH1234AA)",
            "any.required": "Vehicle number is required when bike or car is selected",
          }),
          otherwise: Joi.string().empty("").allow(null).default(null),
        }),
    })
    .min(1),
};

module.exports = { updateUser };

