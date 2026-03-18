const ROLE_TYPES = {
  user: "user",
  owner: "owner",
  admin: "admin",
  manager: "manager",
  employee: "employee",
};

// schema names for mongoose models
const SCHEMA_NAME = {
  staff: "Staff",
  pg: "Pg",
  facilities: "Facilities",
  post: "Post",
  user: "User",
  userPreference: "UserPreference",
};

const GENDER_TYPES = {
  male: "male",
  female: "female",
  unisex: "unisex",
  transgender : "transgender",
  notToSay : "notToSay"
};

module.exports = {
  ROLE_TYPES,
  SCHEMA_NAME,
  GENDER_TYPES,
};
