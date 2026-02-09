const Joi = require("joi");

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
    totalBeds: Joi.number().integer().required(),
    description: Joi.string(),
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
      isActive: Joi.boolean(),
      isDeleted: Joi.boolean(),
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
