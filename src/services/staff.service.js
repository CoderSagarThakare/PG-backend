const { Staff } = require("../models");
const ApiError = require("../utils/ApiError");
const httpStatus = require("http-status");

/**
 * Create Staff
 * @param {Object} staffBody - staff information Object
 * @returns {Promise<Staff>}
 */
const createStaff = async (staffBody) => {
  if (await Staff.isEmailTaken(staffBody.email)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Staff already exists with this email"
    );
  }

  return Staff.create(staffBody);
};

/**
 * Get staff by email
 * @param {string} email
 * @returns {Promise<Staff>}
 */
const getStaffByEmail = async (email) => {
  return Staff.findOne({
    email,
  });
};

const getStaffById = (id) => {
  return Staff.findById(id);
};

/**
 * Update staff by ID
 * @param {string} staffId - staff ID
 * @param {Object} updateBody - update data
 * @returns {Promise<Staff>}
 */
const updateStaffById = async (staffId, updateBody) => {
  const staff = await getStaffById(staffId);
  if (!staff) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Staff not found");
  }
  if (updateBody.email && (await Staff.isEmailTaken(updateBody.email, staffId))) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Staff already exists with this email"
    );
  }

  Object.assign(staff, updateBody);
  await staff.save();

  return staff;
};

/**
 * Get staff by role
 * @param {string} role - staff role
 * @param {Object} options - Query options (limit, page)
 * @returns {Promise<Staff[]>}
 */
const getStaffByRole = async (role, options = {}) => {
  const limit = options.limit || 10;
  const page = options.page || 1;
  const skip = (page - 1) * limit;

  const staff = await Staff.find({ role })
    .limit(limit)
    .skip(skip);
  const total = await Staff.countDocuments({ role });

  return { staff, total, limit, page };
};

/**
 * Get all staff
 * @param {Object} options - Query options (limit, page)
 * @returns {Promise<Staff[]>}
 */
const getAllStaff = async (options = {}) => {
  const limit = options.limit || 10;
  const page = options.page || 1;
  const skip = (page - 1) * limit;

  const staff = await Staff.find()
    .limit(limit)
    .skip(skip);
  const total = await Staff.countDocuments();

  return { staff, total, limit, page };
};

module.exports = {
  createStaff,
  getStaffByEmail,
  getStaffById,
  updateStaffById,
  getStaffByRole,
  getAllStaff,
};
