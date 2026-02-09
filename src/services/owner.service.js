const { PG } = require("../models");
const ApiError = require("../utils/ApiError");
const httpStatus = require("http-status");

/**
 * Create PG
 * @param {Object} pgBody - PG information Object
 * @returns {Promise<PG>}
 */
const createPG = async (pgBody) => {
  try {
    const pg = await PG.create({ ...pgBody, isDeleted: false });
    return pg;
  } catch (error) {
    throw error;
  }
};

/**
 * Get PGs by Owner
 * @param {string} ownerId - Owner ID
 * @param {Object} options - Query options (limit, page, sortBy)
 * @param {boolean} isAdmin - Whether user is admin (if true, returns all records including deleted)
 * @returns {Promise<PG[]>}
 */
const getPGsByOwner = async (ownerId, options = {}, isAdmin = false) => {
  try {
    const limit = options.limit || 10;
    const page = options.page || 1;
    const skip = (page - 1) * limit;

    const query = { ownerId };
    if (!isAdmin) {
      query.isDeleted = false;
    }

    const pgs = await PG.find(query).limit(limit).skip(skip);
    const total = await PG.countDocuments(query);

    return { pgs, total, limit, page };
  } catch (error) {
    throw error;
  }
};

/**
 * Get PG by ID
 * @param {string} pgId - PG ID
 * @param {string} ownerId - Owner ID for verification
 * @param {boolean} isAdmin - Whether user is admin (if true, returns deleted records too)
 * @returns {Promise<PG>}
 */
const getPGById = async (pgId, ownerId, isAdmin = false) => {
  try {
    const query = { _id: pgId, ownerId };
    if (!isAdmin) {
      query.isDeleted = false;
    }
    const pg = await PG.findOne(query);
    if (!pg) {
      throw new ApiError(httpStatus.NOT_FOUND, "PG not found");
    }
    return pg;
  } catch (error) {
    throw error;
  }
};

/**
 * Update PG
 * @param {string} pgId - PG ID
 * @param {string} ownerId - Owner ID for verification
 * @param {Object} updateBody - Update data
 * @returns {Promise<PG>}
 */
const updatePG = async (pgId, ownerId, updateBody) => {
  try {
    const pg = await PG.findOne({ _id: pgId, ownerId, isDeleted: false });
    if (!pg) {
      throw new ApiError(httpStatus.NOT_FOUND, "PG not found");
    }
    Object.assign(pg, updateBody);
    await pg.save();
    return ;
  } catch (error) {
    throw error;
  }
};

/**
 * Delete PG (Soft Delete)
 * @param {string} pgId - PG ID
 * @param {string} ownerId - Owner ID for verification
 * @returns {Promise<void>}
 */
const deletePG = async (pgId, ownerId) => {
  try {
    const pg = await PG.findOne({ _id: pgId, ownerId });
    if (!pg) {
      throw new ApiError(httpStatus.NOT_FOUND, "PG not found");
    }
    await PG.updateOne({ _id: pgId }, { isDeleted: true });
  } catch (error) {
    throw error;
  }
};

/**
 * Get all PGs (Admin access - includes deleted records)
 * @param {Object} options - Query options (limit, page, sortBy)
 * @returns {Promise<PG[]>}
 */
const getAllPGs = async (options = {}) => {
  try {
    const limit = options.limit || 10;
    const page = options.page || 1;
    const skip = (page - 1) * limit;

    const pgs = await PG.find().limit(limit).skip(skip);
    const total = await PG.countDocuments();

    return { pgs, total, limit, page };
  } catch (error) {
    throw error;
  }
};

/**
 * Restore deleted PG (Admin only)
 * @param {string} pgId - PG ID
 * @returns {Promise<void>}
 */
const restorePG = async (pgId) => {
  try {
    const pg = await PG.findById(pgId);
    if (!pg) {
      throw new ApiError(httpStatus.NOT_FOUND, "PG not found");
    }
    await PG.updateOne({ _id: pgId }, { isDeleted: false });
  } catch (error) {
    throw error;
  }
};

module.exports = {
  createPG,
  getPGsByOwner,
  getPGById,
  updatePG,
  deletePG,
  getAllPGs,
  restorePG,
};
