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
  male: "Male",
  female: "Female",
  unisex: "Unisex",
  transgender: "Transgender",
  preferNotToSay: "PreferNotToSay",
};

const PG_TYPES = {
  male: "Male",
  female: "Female",
  unisex: "Unisex",
  coLiving: "Co-Living",
};

module.exports = {
  ROLE_TYPES,
  SCHEMA_NAME,
  GENDER_TYPES,
  PG_TYPES,
};
