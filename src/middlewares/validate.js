const Joi = require("joi");
const httpStatus = require("http-status");
const pick = require("../utils/pick");
const ApiError = require("../utils/ApiError");

const validate = (schema) => (req, res, next) => {
    
  // validSchema : pick method returns a new object, if schema contains ['params', 'query', 'body'] key in schema
  const validSchema = pick(schema, ["params", "query", "body"]);

  //   object : jr validSchema madhlya keys cha object req mdhe present aastil tr tyanna combine krun new object return kela jato.
  const object = pick(req, Object.keys(validSchema));

  const { value, error } = Joi.compile(validSchema)
    .prefs({ errors: { label: "key" }, abortEarly: false })
    .validate(object);

  if (error) {
    const errorMessage = error.details
      .map((details) => details.message)
      .join(", ");
    return next(new ApiError(httpStatus.BAD_REQUEST, errorMessage));
  }
  Object.assign(req, value);
  return next();
};
  
module.exports = validate;
