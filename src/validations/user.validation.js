const Joi = require("joi");

const updateUser = {
  body: Joi.object()
    .keys({
      name: Joi.string(),
      picture: Joi.string(),
    })
    .min(1),
};

module.exports = { updateUser };
