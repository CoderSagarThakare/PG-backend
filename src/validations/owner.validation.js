const Joi = require("joi");

const createPG = {
  body: Joi.object().keys({
    name: Joi.string().required(),
    address: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    zipCode: Joi.string().required(),
    totalRooms: Joi.number().integer().required(),
    totalBeds: Joi.number().integer().required(),
    description: Joi.string(),
  }),
};

const updatePG = {
  params: Joi.object().keys({
    pgId: Joi.string().required(),
  }),
  body: Joi.object().keys({
    name: Joi.string(),
    address: Joi.string(),
    city: Joi.string(),
    state: Joi.string(),
    zipCode: Joi.string(),
    totalRooms: Joi.number().integer(),
    description: Joi.string(),
  }),
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
