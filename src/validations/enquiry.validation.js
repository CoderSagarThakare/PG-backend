const Joi = require("joi");
const { objectId } = require("./custom.validation");

const createEnquiry = {
  body: Joi.object().keys({
    postId: Joi.string().required().custom(objectId),
  }),
};

const getEnquiries = {
  query: Joi.object().keys({
    status: Joi.string().valid(
      "interested",
      "contacted",
      "visited",
      "dealDone",
      "rejected",
      "inventoryFull"
    ),
    pgId: Joi.string().custom(objectId),
    postId: Joi.string().custom(objectId),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
    sortBy: Joi.string(),
  }),
};

// const getEnquiry = {
//   params: Joi.object().keys({
//     enquiryId: Joi.string().custom(objectId).required(),
//   }),
// };

// const updateEnquiry = {
//   params: Joi.object().keys({
//     enquiryId: Joi.string().custom(objectId).required(),
//   }),
//   body: Joi.object()
//     .keys({
//       status: Joi.string().valid(
//         "interested",
//         "contacted",
//         "visited",
//         "dealDone",
//         "rejected",
//         "inventoryFull"
//       ),
//       staffRemarks: Joi.string().max(500),
//       userRemark: Joi.string().max(300),
//     })
//     .min(1),
// };

// const deleteEnquiry = {
//   params: Joi.object().keys({
//     enquiryId: Joi.string().custom(objectId).required(),
//   }),
// };

module.exports = {
  createEnquiry,
  getEnquiries,
  // getEnquiry,
  // updateEnquiry,
  // deleteEnquiry,
};