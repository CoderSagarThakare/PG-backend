const Joi = require("joi");
const { objectId } = require("./custom.validation");

const createOrUpdateReview = {
  body: Joi.object().keys({
    pgId: Joi.string().custom(objectId).required(),
    rating: Joi.number().min(1).max(5).precision(1).required(),
    comment: Joi.string().max(500).allow("").trim(),
  }),
};

const getPGReviews = {
  params: Joi.object().keys({
    pgId: Joi.string().custom(objectId).required(),
  }),
  query: Joi.object().keys({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
  }),
};

const getMyReview = {
  params: Joi.object().keys({
    pgId: Joi.string().custom(objectId).required(),
  }),
};

const deleteReview = {
  params: Joi.object().keys({
    reviewId: Joi.string().custom(objectId).required(),
  }),
};

module.exports = {
  createOrUpdateReview,
  getPGReviews,
  getMyReview,
  deleteReview,
};
