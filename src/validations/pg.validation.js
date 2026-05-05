const Joi = require("joi");
const { PG_TYPES } = require("../const/constant");
const objectIdPattern = /^[0-9a-fA-F]{24}$/;

const createPG = {
  body: Joi.object().keys({
    name: Joi.string().required(),
    address: Joi.object()
      .keys({
        pincode: Joi.number().required(),
        locationDescription: Joi.string().optional(),
        landmark: Joi.string().required(),
        city: Joi.string().required(),
        state: Joi.string().required(),
        country: Joi.string().required(),
      })
      .required(),
    description: Joi.string(),
    managerId: Joi.string().pattern(objectIdPattern).required().messages({
      "string.pattern.base": "Invalid manager ID format",
    }),
    pgType: Joi.string()
      .valid(PG_TYPES.male, PG_TYPES.female, PG_TYPES.unisex, PG_TYPES.coLiving)
      .required(),
    landline: Joi.string(),
    pgStartedDate: Joi.date(),
    images: Joi.array().items(Joi.string()),
    locationLink: Joi.string().uri(),
    checkInTime: Joi.string(),
    checkOutTime: Joi.string(),
    facilities: Joi.array()
      .items(
        Joi.string()
          .pattern(objectIdPattern)
          .messages({ "string.pattern.base": "Invalid facility ID format" }),
      )
      .unique()
      .min(1)
      .required()
      .messages({
        "array.base": "Facilities must be an array",
        "array.min": "Please select at least one facility",
        "any.required": "Facilities are required",
      }),
    totalRooms: Joi.any(),
    totalBeds: Joi.any(),
    occupiedBeds: Joi.any(),
    emptyBeds: Joi.any(),
  }),
};

const updatePG = {
  params: Joi.object().keys({
    pgId: Joi.string().required(),
  }),
  body: Joi.object()
    .keys({
      name: Joi.string(),
      address: Joi.object().keys({
        pincode: Joi.number(),
        locationDescription: Joi.string().optional(),
        landmark: Joi.string(),
        city: Joi.string(),
        state: Joi.string(),
        country: Joi.string(),
      }),
      managerId: Joi.string().pattern(objectIdPattern).messages({
        "string.pattern.base": "Invalid manager ID format",
      }),
       pgType: Joi.string()
      .valid(PG_TYPES.male, PG_TYPES.female, PG_TYPES.unisex, PG_TYPES.coLiving),
      description: Joi.string(),
      landline: Joi.string(),
      pgStartedDate: Joi.date(),
      images: Joi.array().items(Joi.string()),
      locationLink: Joi.string().uri(),
      checkInTime: Joi.string(),
      checkOutTime: Joi.string(),
      isActive: Joi.boolean(),
      isDeleted: Joi.boolean(),
      facilities: Joi.array()
        .items(
          Joi.string()
            .pattern(objectIdPattern)
            .messages({ "string.pattern.base": "Invalid facility ID format" }),
        )
        .unique()
        .min(1)
        .optional()
        .messages({
          "array.base": "Facilities must be an array",
          "array.min":
            "Please select at least one facility if providing facilities",
        }),
      totalRooms: Joi.any(),
      totalBeds: Joi.any(),
      occupiedBeds: Joi.any(),
      emptyBeds: Joi.any(),
    })
    .min(1),
};

const getPG = {
  params: Joi.object().keys({
    pgId: Joi.string().required(),
  }),
};

const deletePG = {
  params: Joi.object().keys({
    pgId: Joi.string().required(),
  }),
};

const listPGs = {
  query: Joi.object().keys({
    limit: Joi.number().integer().min(1).default(10),
    page: Joi.number().integer().min(1).default(1),
    sortBy: Joi.string(),
  }),
};

module.exports = {
  createPG,
  updatePG,
  getPG,
  deletePG,
  listPGs,
};
