const Joi = require('joi');

const createRoom = {
  body: Joi.object().keys({
    pgId: Joi.string().required().custom((value, helpers) => {
      if (!value.match(/^[0-9a-fA-F]{24}$/)) return helpers.message('"pgId" must be a valid Mongo ID');
      return value;
    }),
    roomNumber: Joi.string().required(),
    floor: Joi.number().required(),
    sharingType: Joi.number().required().min(1).max(20),
    roomType: Joi.string().valid('AC', 'Non-AC'),
    unitType: Joi.string().allow('', null).optional(),
    beds: Joi.array().items(
      Joi.object().keys({
        bedNumber: Joi.string().required(),
        price: Joi.number().required().min(0),
        position: Joi.string().allow('', null),
      })
    ).length(Joi.ref('sharingType')).required(),
  }),
};

const updateRoom = {
  params: Joi.object().keys({
    roomId: Joi.string().required(),
  }),
  body: Joi.object().keys({
    roomNumber: Joi.string().optional(),
    floor: Joi.number().optional(),
    sharingType: Joi.number().min(1).max(20).optional(),
    roomType: Joi.string().valid('AC', 'Non-AC').optional(),
    unitType: Joi.string().allow('', null).optional(),
    beds: Joi.array().items(
      Joi.object().keys({
        _id: Joi.string().optional(),
        bedNumber: Joi.string().optional(),
        price: Joi.number().optional().min(0),
        position: Joi.string().allow('', null).optional(),
        status: Joi.string().optional(),
      }).unknown()
    ).optional(),
  }).unknown(),
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
    joiningDate: Joi.date().iso().optional().allow("", null),
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
  updateRoom,
  getRooms,
  assignTenant,
  updateBed,
};
