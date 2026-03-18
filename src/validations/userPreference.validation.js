const Joi = require("joi");
const { PG_TYPES } = require("../const/constant");

const preferenceIdValidation = Joi.string()
  .regex(/^[0-9a-fA-F]{24}$/)
  .required()
  .messages({
    "string.pattern.base": "Invalid Preference ID format",
  });

const createPreference = {
  body: Joi.object().keys({
    location: Joi.object().keys({
      type: Joi.string().valid("Point").default("Point"),
      coordinates: Joi.array().items(Joi.number()).length(2).required(),
    }),
    pincode: Joi.number().integer().required(),
    city: Joi.string().required().trim(),
    budget: Joi.object()
      .keys({
        min: Joi.number().min(0).default(0),
        max: Joi.number().greater(Joi.ref("min")).required().messages({
          "number.greater":
            "Maximum budget must be greater than minimum budget",
        }),
      })
      .required(),
    pgType: Joi.string()
      .valid(PG_TYPES.male, PG_TYPES.female, PG_TYPES.unisex, PG_TYPES.coLiving)
      .required(),
    facilities: Joi.array().items(Joi.string().regex(/^[0-9a-fA-F]{24}$/)),
  }),
};

const updatePreference = {
  params: Joi.object().keys({
    preferenceId: preferenceIdValidation,
  }),
  body: Joi.object()
    .keys({
      location: Joi.object().keys({
        type: Joi.string().valid("Point"),
        coordinates: Joi.array().items(Joi.number()).length(2),
      }),
      pincode: Joi.number().integer(),
      city: Joi.string().trim(),
      budget: Joi.object().keys({
        min: Joi.number().min(0).default(0), // Agar nahi aaya toh 0 maan lega
        max: Joi.number()
          .min(Joi.ref("min"))
          .when("min", {
            is: Joi.exist().not(0), // Agar min bhej rahe ho (and it's not the default 0)
            then: Joi.required(),
            otherwise: Joi.optional(),
          })
          .messages({
            "any.required": "Max budget required with min.",
            "number.min": "Max budget cannot be less than min.",
          }),
      }),
      pgType: Joi.string().valid(
        PG_TYPES.male,
        PG_TYPES.female,
        PG_TYPES.unisex,
        PG_TYPES.coLiving,
      ),
      facilities: Joi.array().items(Joi.string().regex(/^[0-9a-fA-F]{24}$/)),
      isActive: Joi.boolean(),
      isDeleted: Joi.boolean(),
    })
    .min(1),
};
const getPreference = {
  params: Joi.object().keys({
    preferenceId: preferenceIdValidation,
  }),
};

const deletePreference = {
  params: Joi.object().keys({
    preferenceId: preferenceIdValidation,
  }),
};

module.exports = {
  createPreference,
  updatePreference,
  getPreference,
  deletePreference,
};
