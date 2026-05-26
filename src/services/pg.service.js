const { PG, Bed } = require("../models");
const ApiError = require("../utils/ApiError");
const httpStatus = require("http-status");
const awsService = require("./aws.service");

const extractS3Key = (urlOrKey) => {
  if (!urlOrKey) return urlOrKey;
  if (urlOrKey.startsWith("http://") || urlOrKey.startsWith("https://")) {
    try {
      const url = new URL(urlOrKey);
      return decodeURIComponent(url.pathname.substring(1));
    } catch (e) {
      return urlOrKey;
    }
  }
  return urlOrKey;
};

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
    if (pgBody.images) {
      pgBody.images = pgBody.images.map(extractS3Key);
    }
    const pg = await PG.create({ 
      ...pgBody, 
      totalRooms: 0,
      totalBeds: 0,
      occupiedBeds: 0,
      emptyBeds: 0,
      isDeleted: false 
    });
    return pg;
  } catch (error) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, "Failed to create PG");
  }
};

/**
 * Get PGs by Owner
 * @param {string} staffId - Staff ID (Owner or Manager)
 * @param {Object} options - Query options (limit, page, sortBy)
 * @param {boolean} isAdmin - Whether user is admin (if true, returns all records including deleted)
 * @returns {Promise<PG[]>}
 */
const getPGsByOwner = async (staffId, options = {}, isAdmin = false) => {
  try {
    const limit = options.limit || 10;
    const page = options.page || 1;
    const skip = (page - 1) * limit;

    const query = { $or: [{ ownerId: staffId }, { managerId: staffId }] };
    if (!isAdmin) {
      query.isDeleted = false;
    }

    let pgs = await PG.find(query)
      .limit(limit)
      .skip(skip)
      .select("name address.city address.state pgType totalRooms totalBeds emptyBeds occupiedBeds managerId rating isActive images")
      .populate("managerId", "name")
      .lean();

    // Resolve S3 image keys to signed GET URLs
    for (const pg of pgs) {
      if (pg.images && pg.images.length > 0) {
        pg.images = await Promise.all(pg.images.map(img => awsService.getFileUrl(img)));
      }
    }

    // Ensure numeric fields are never null for UI stability
    pgs = pgs.map(pg => ({
      ...pg,
      totalRooms: pg.totalRooms || 0,
      totalBeds: pg.totalBeds || 0,
      emptyBeds: pg.emptyBeds || 0,
      occupiedBeds: pg.occupiedBeds || 0,
      rating: pg.rating || 0
    }));

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
 * @param {string} staffId - Staff ID for verification
 * @param {boolean} isAdmin - Whether user is admin (if true, returns deleted records too)
 * @returns {Promise<PG>}
 */
const getPGById = async (pgId, staffId, isAdmin = false) => {
  try {
    const query = { _id: pgId };

    // only pg manager or owner can create a post
    // Allow viewing if user is admin, OR if the property is active and user is a regular 'user',
    // OR if the user is the specific owner/manager of the property.
    if (!isAdmin) {
      query.isDeleted = false;
      if (staffId && (staffId.role === 'owner' || staffId.role === 'manager')) {
        query.$or = [{ ownerId: staffId.id || staffId }, { managerId: staffId.id || staffId }];
      } else {
        query.isActive = true;
      }
    }

    const pg = await PG.findOne(query)
      .populate("ownerId", "name email role email mobNo1 mobNo2")
      .populate("managerId", "name email role email mobNo1 mobNo2")
      .populate("facilities", "name")
      .lean();

    if (!pg) {
      const message = isAdmin
        ? "No PG found with the provided ID."
        : "PG not found, or it has been deactivated/deleted.";

      throw new ApiError(httpStatus.NOT_FOUND, message);
    }

    // Resolve S3 image keys to signed GET URLs
    if (pg.images && pg.images.length > 0) {
      pg.images = await Promise.all(pg.images.map(img => awsService.getFileUrl(img)));
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
 * @param {string} staffId - Staff ID for verification
 * @param {Object} updateBody - Update data
 * @returns {Promise<PG>}
 */
const updatePG = async (pgId, staffId, updateBody) => {
  try {
    // Normalize image urls to keys and delete orphaned S3 files
    if (updateBody.images) {
      updateBody.images = updateBody.images.map(extractS3Key);
      try {
        const oldPg = await PG.findOne({ _id: pgId, $or: [{ ownerId: staffId }, { managerId: staffId }], isDeleted: false });
        if (oldPg && oldPg.images) {
          const removedImages = oldPg.images.filter(img => !updateBody.images.includes(img));
          for (const img of removedImages) {
            await awsService.deleteFile(img).catch(() => {});
          }
        }
      } catch (e) {
        console.error("Error cleaning orphaned PG images from S3:", e);
      }
    }

    // User will pass only updated data in address
    if (updateBody.address) {
      Object.keys(updateBody.address).forEach((key) => {
        updateBody[`address.${key}`] = updateBody.address[key];
      });
      delete updateBody.address;
    }

    const pg = await PG.findOneAndUpdate(
      { _id: pgId, $or: [{ ownerId: staffId }, { managerId: staffId }], isDeleted: false },
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
 * @param {string} staffId - Staff ID for verification
 * @returns {Promise<void>}
 */
const deletePG = async (pgId, staffId) => {
  try {
    const pg = await PG.findOne({ _id: pgId, $or: [{ ownerId: staffId }, { managerId: staffId }] });
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

/**
 * Discover PGs (Public access for users)
 * @param {Object} filter - Filter options (city, pgType, facilities)
 * @param {Object} options - Query options (limit, page)
 * @returns {Promise<Object>}
 */
const discoverPGs = async (filter = {}, options = {}) => {
  try {
    const limit = options.limit || 9;
    const page = options.page || 1;
    const skip = (page - 1) * limit;

    const query = { isDeleted: false, isActive: true };
    
    if (filter.city) {
      query['address.city'] = { $regex: filter.city, $options: 'i' };
    }
    if (filter.pgType) {
      query.pgType = filter.pgType;
    }
    if (filter.facilities && filter.facilities.length > 0) {
      query.facilities = { $all: filter.facilities };
    }

    const pgs = await PG.find(query)
      .limit(limit)
      .skip(skip)
      .select("name address.city address.state pgType totalRooms totalBeds emptyBeds occupiedBeds rating facilities images")
      .populate("facilities", "name")
      .lean();

    // Resolve S3 image keys to signed GET URLs
    for (const pg of pgs) {
      if (pg.images && pg.images.length > 0) {
        pg.images = await Promise.all(pg.images.map(img => awsService.getFileUrl(img)));
      }
    }

    const total = await PG.countDocuments(query);

    return { pgs, total, limit, page };
  } catch (error) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, "Failed to discover PGs");
  }
};

const getPriceRange = async (pgId) => {
  const beds = await Bed.find({ pgId, status: "available", isDeleted: false });
  if (!beds || beds.length === 0) {
    return { minPrice: 0, maxPrice: 0 };
  }
  let min = beds[0].price;
  let max = beds[0].price;
  for (const bed of beds) {
    if (bed.price < min) min = bed.price;
    if (bed.price > max) max = bed.price;
  }
  return { minPrice: min, maxPrice: max };
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
  discoverPGs,
  getPriceRange,
};
