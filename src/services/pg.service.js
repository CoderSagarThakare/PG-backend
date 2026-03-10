const { PG } = require("../models");
const ApiError = require("../utils/ApiError");
const httpStatus = require("http-status");

const checkExistingPG = async (ownerId, name) => {
  const existingPG = await PG.findOne({
    ownerId: ownerId,
    name: name,
  });

  if (existingPG) {
    throw new ApiError(
      httpStatus.CONFLICT,
      "You already have a PG with this name",
    );
  }

  return;
};

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
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, "Failed to create PG");
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
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to retrieve PGs",
    );
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

    const pg = await PG.findOne(query)
      .populate("ownerId", "name email role email")
      .populate("managerId", "name email role email")
      .populate("facilities");

    if (!pg) {
      const message = isAdmin
        ? "No PG found with the provided ID."
        : "PG not found, or it has been deactivated/deleted.";

      throw new ApiError(httpStatus.NOT_FOUND, message);
    }

    return pg;
  } catch (error) {
    console.log("error : ", error);
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to retrieve PG",
    );
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
    // User will pass only updated data in address
    if (updateBody.address) {
      Object.keys(updateBody.address).forEach((key) => {
        updateBody[`address.${key}`] = updateBody.address[key];
      });
      delete updateBody.address;
    }

    const pg = await PG.findOneAndUpdate(
      { _id: pgId, ownerId, isDeleted: false },
      { $set: updateBody },
      { runValidators: true }, // validate data before updating data in DB
    );

    if (!pg) {
      throw new ApiError(httpStatus.NOT_FOUND, "PG not found or access denied");
    }

    return;
  } catch (error) {
    console.log("error : ", error.message);
    if (error instanceof ApiError) throw error;
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, "Failed to update PG");
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
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, "Failed to delete PG");
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
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to retrieve PGs",
    );
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
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to restore PG",
    );
  }
};

module.exports = {
  checkExistingPG,
  createPG,
  getPGsByOwner,
  getPGById,
  updatePG,
  deletePG,
  getAllPGs,
  restorePG,
};
