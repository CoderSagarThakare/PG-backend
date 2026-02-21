const Joi = require("joi");
const objectIdPattern = /^[0-9a-fA-F]{24}$/;

const createPost = {
  body: Joi.object().keys({
    pgId: Joi.string()
      .pattern(objectIdPattern)
      .required()
      .messages({ "string.pattern.base": "Invalid PG ID format" }),

    title: Joi.string().required().trim().max(100), // e.g. "Double Sharing Bed Available"
    description: Joi.string().required().trim(),

    vacancyCount: Joi.number().integer().min(1).required(),
    gender: Joi.string().valid("boys", "girls", "unisex").required(),
    pricePerBed: Joi.number().required(),

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

      // Conditional Validation
      vacancyCount: Joi.number()
        .integer()
        .min(0)
        .when("isActive", {
          is: Joi.equal(true),
          then: Joi.number().min(1).messages({
            "number.min":
              "Vacancy count must be at least 1 when post is active",
          }),
          otherwise: Joi.number().min(0),
        }),

      gender: Joi.string().valid("boys", "girls", "unisex"),
      pricePerBed: Joi.number(),
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
    gender: Joi.string().valid("boys", "girls", "unisex").optional(),
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
