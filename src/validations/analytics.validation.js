const Joi = require("joi");
const { objectId } = require("./custom.validation");

const getOverview = {
  query: Joi.object().keys({
    pgId: Joi.string().custom(objectId).allow("", null),
    months: Joi.number().integer().min(1).max(36).default(6),
  }),
};

module.exports = {
  getOverview,
};
