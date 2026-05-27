const Joi = require("joi");
const { PG_TYPES, OCCUPANCY_TYPES } = require("../const/constant");
const objectIdPattern = /^[0-9a-fA-F]{24}$/;

const createPost = {
  body: Joi.object().keys({
    pgId: Joi.string()
      .pattern(objectIdPattern)
      .required()
      .messages({ "string.pattern.base": "Invalid PG ID format" }),

    title: Joi.string().required().trim().max(100),
    description: Joi.string().required().trim(),

    // For unisex PGs vacancyCount is computed server-side from male+female counts
    vacancyCount: Joi.number().integer().min(0).allow(null, '').optional(),
    maleVacancyCount: Joi.number().integer().min(0).allow(null, '').optional(),
    femaleVacancyCount: Joi.number().integer().min(0).allow(null, '').optional(),
    pgType: Joi.string()
      .valid(PG_TYPES.male, PG_TYPES.female, PG_TYPES.unisex, PG_TYPES.coLiving)
      .required(),
    minPrice: Joi.number().required(),
    maxPrice: Joi.number().required(),
    occupancyType: Joi.string()
      .valid(
        OCCUPANCY_TYPES.single,
        OCCUPANCY_TYPES.double,
        OCCUPANCY_TYPES.triple,
        OCCUPANCY_TYPES.four,
        OCCUPANCY_TYPES.other,
      )
      .required(),

    availableFrom: Joi.date().default(Date.now),
    images: Joi.array().items(Joi.string()).optional(),
  }),
};

const updatePost = {
  params: Joi.object().keys({
    postId: Joi.string().pattern(objectIdPattern).required(),
  }),
  body: Joi.object()
    .keys({
      title: Joi.string().trim().max(100),
      description: Joi.string().trim(),

      vacancyCount: Joi.number().integer().min(0).allow(null, '').optional(),
      maleVacancyCount: Joi.number().integer().min(0).allow(null, '').optional(),
      femaleVacancyCount: Joi.number().integer().min(0).allow(null, '').optional(),

      pgId: Joi.string().pattern(objectIdPattern),
      pgType: Joi.string().valid(PG_TYPES.male, PG_TYPES.female, PG_TYPES.unisex, PG_TYPES.coLiving),
      occupancyType: Joi.string().valid(
        OCCUPANCY_TYPES.single,
        OCCUPANCY_TYPES.double,
        OCCUPANCY_TYPES.triple,
        OCCUPANCY_TYPES.four,
        OCCUPANCY_TYPES.other,
      ),
      gender: Joi.string().valid("male", "female", "unisex"),
      minPrice: Joi.number(),
      maxPrice: Joi.number(),
      availableFrom: Joi.date(),
      images: Joi.array().items(Joi.string()),
      isActive: Joi.boolean(),
    })
    .min(1),
};

const getPost = {
  params: Joi.object().keys({
    postId: Joi.string().pattern(objectIdPattern).required(),
  }),
};

const deletePost = {
  params: Joi.object().keys({
    postId: Joi.string().pattern(objectIdPattern).required(),
  }),
};

const listPosts = {
  query: Joi.object().keys({
    pgId: Joi.string().pattern(objectIdPattern).optional(), // Filter by specific PG
    gender: Joi.string().valid("male", "female", "unisex").optional(),
    minPrice: Joi.number().optional(),
    maxPrice: Joi.number().optional(),
    sortBy: Joi.string(),
    limit: Joi.number().integer().min(1).default(10),
    page: Joi.number().integer().min(1).default(1),
  }),
};

module.exports = {
  createPost,
  updatePost,
  getPost,
  deletePost,
  listPosts,
};
