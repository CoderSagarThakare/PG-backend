const Joi = require("joi");
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
    totalRooms: Joi.number().integer().required(),
    description: Joi.string(),
    manager: Joi.object().keys({
      name: Joi.string().required(),
      mobNo1: Joi.string().required(),
      mobNo2: Joi.string(),
    }),
    beds: Joi.object().keys({
      totalBeds: Joi.number().integer(),
      occupiedBeds: Joi.number().integer().min(0),
      emptyBeds: Joi.number().integer().min(0),
    }),
    landline: Joi.string(),
    pgStartedDate: Joi.date(),
    images: Joi.array().items(Joi.string()),
    locationLink: Joi.string().uri(),
    checkInTime: Joi.string(),
    checkOutTime: Joi.string(),
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
      totalRooms: Joi.number().integer(),
      description: Joi.string(),
      rating: Joi.number().min(0).max(5),
      manager: Joi.object().keys({
        name: Joi.string(),
        mobNo1: Joi.string(),
        mobNo2: Joi.string(),
      }),
      beds: Joi.object().keys({
        totalBeds: Joi.number().integer(),
        occupiedBeds: Joi.number().integer().min(0),
        emptyBeds: Joi.number().integer().min(0),
      }),
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
