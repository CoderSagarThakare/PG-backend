const Joi = require('joi');

const createRoom = {
  body: Joi.object().keys({
    pgId: Joi.string().required().custom((value, helpers) => {
      if (!value.match(/^[0-9a-fA-F]{24}$/)) return helpers.message('"pgId" must be a valid Mongo ID');
      return value;
    }),
    roomNumber: Joi.string().required(),
    floor: Joi.number().required(),
    sharingType: Joi.number().required().min(1),
    roomType: Joi.string().valid('AC', 'Non-AC'),
    beds: Joi.array().items(
      Joi.object().keys({
        bedNumber: Joi.string().required(),
        price: Joi.number().required().min(0),
        position: Joi.string().allow('', null),
      })
    ).length(Joi.ref('sharingType')).required(),
  }),
};

const getRooms = {
  params: Joi.object().keys({
    pgId: Joi.string().required().custom((value, helpers) => {
      if (!value.match(/^[0-9a-fA-F]{24}$/)) return helpers.message('"pgId" must be a valid Mongo ID');
      return value;
    }),
  }),
};

const assignTenant = {
  params: Joi.object().keys({
    bedId: Joi.string().required(),
  }),
  body: Joi.object().keys({
    userId: Joi.string().required(),
  }),
};

const updateBed = {
  params: Joi.object().keys({
    bedId: Joi.string().required(),
  }),
  body: Joi.object().keys({
    price: Joi.number().min(0),
    position: Joi.string(),
    status: Joi.string().valid('available', 'occupied', 'maintenance'),
  }),
};

module.exports = {
  createRoom,
  getRooms,
  assignTenant,
  updateBed,
};
