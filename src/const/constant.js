const ROLE_TYPES = {
  user: "user",
  owner: "owner",
  admin: "admin",
  manager: "manager",
  employee: "employee",
};

// schema names for mongoose models
const SCHEMA_NAME = {
  pg: "Pg",
  facilities: "Facilities",
  post: "Post",
  user: "User",
  userPreference: "UserPreference",
  enquiry : "Enquiry",
  room: "Room",
  bed: "Bed",
  employee: "Employee",
  expense: "Expense",
  staffPayment: "StaffPayment",
  review: "Review",
  onboarding: "Onboarding",
  bedAssignment: "BedAssignment",
  preBooking: "PreBooking",
};

const GENDER_TYPES = {
  male: "male",
  female: "female",
  unisex: "unisex",
  transgender: "transgender",
  preferNotToSay: "preferNotToSay",
};

const PG_TYPES = {
  male: "male",
  female: "female",
  unisex: "unisex",
  coLiving: "coLiving",
};

const OCCUPANCY_TYPES = {
  single: "single",
  double: "double",
  triple: "triple",
  four: "four",
  other: "other",
};

module.exports = {
  ROLE_TYPES,
  SCHEMA_NAME,
  GENDER_TYPES,
  PG_TYPES,
  OCCUPANCY_TYPES
};
