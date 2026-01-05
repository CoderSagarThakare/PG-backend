/**
 * A mongoose schema plugin which applies the following in the toJSON transform call:
 *  - removes __v and any path that has private: true
 */

// QUE : WHEN PRIVATE PLUGIN WILL TRIGGERED
/**
 * When you retrieve data from MongoDB using Mongoose methods (find(), findOne(), etc.), 
 * the retrieved data is represented as Mongoose documents. 
 * When you then convert these Mongoose documents to JSON, 
 * the private plugin logic will be triggered during the serialization process.
 * 
 * In Mongoose, the process responsible for converting Mongoose documents to JSON when retrieving data is the toJSON() method.
 * serializations : serialization commonly involves converting Mongoose documents (which are JavaScript objects) into JSON format.
 * 
 * when given retrieved data we are sending as a response at that time our private plugin will be called. 
 * 
 */

const private = (schema) => {

  let transform;
  if (schema.options.toJSON && schema.options.toJSON.transform) {
    transform = schema.options.toJSON.transform;
  }

  schema.options.toJSON = Object.assign(schema.options.toJSON || {}, {
    transform(doc, ret, options) {
      Object.keys(schema.paths).forEach((path) => {
        if (schema.paths[path].options && schema.paths[path].options.private) {
          deleteAtPath(ret, path.split("."), 0);
        }
      });

      delete ret.__v;

      if (transform) {
        return transform(doc, ret, options);
      }
    },
  });
};

const deleteAtPath = (obj, path, index) => {
  if (index === path.length - 1) {
    delete obj[path[index]];
    return;
  }
  deleteAtPath(obj[path[index]], path, index + 1);
};
module.exports= private;

/**
 * This function modifies the schema.options.toJSON.transform method to add privacy control.
 * It loops through all the fields (schema.paths) in the schema and checks if a field is marked as private.
 * If a field is marked as private, it uses the deleteAtPath function to delete that field from the output.
 */
