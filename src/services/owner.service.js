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
    const pg = await PG.create(pgBody);
    return pg;
  } catch (error) {
    throw error;
  }
};

/**
 * Get PGs by Owner
 * @param {string} ownerId - Owner ID
 * @param {Object} options - Query options (limit, page, sortBy)
 * @returns {Promise<PG[]>}
 */
const getPGsByOwner = async (ownerId, options = {}) => {
  try {
    const limit = options.limit || 10;
    const page = options.page || 1;
    const skip = (page - 1) * limit;

    const pgs = await PG.find({ ownerId }).limit(limit).skip(skip);
    const total = await PG.countDocuments({ ownerId });

    return { pgs, total, limit, page };
  } catch (error) {
    throw error;
  }
};

/**
 * Get PG by ID
 * @param {string} pgId - PG ID
 * @param {string} ownerId - Owner ID for verification
 * @returns {Promise<PG>}
 */
const getPGById = async (pgId, ownerId) => {
  try {
    const pg = await PG.findOne({ _id: pgId, ownerId });
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
    const pg = await PG.findOne({ _id: pgId, ownerId });
    if (!pg) {
      throw new ApiError(httpStatus.NOT_FOUND, "PG not found");
    }
    Object.assign(pg, updateBody);
    await pg.save();
    return pg;
  } catch (error) {
    throw error;
  }
};

/**
 * Delete PG
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
    await PG.deleteOne({ _id: pgId });
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
};
