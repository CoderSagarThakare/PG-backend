const { PG, Bed, Room, Employee } = require("../models");
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

const getDistanceKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Straight-line distance in km

  // Dynamic scaling based on straight-line distance
  let factor = 1.15;
  if (d > 7) {
    factor = 1.4;
  } else if (d >= 3) {
    factor = 1.25;
  }

  const road = d * factor;
  return Number(road.toFixed(2));
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
    if (pgBody.paymentQrKey) {
      pgBody.paymentQrKey = extractS3Key(pgBody.paymentQrKey);
    }
    const pg = await PG.create({ 
      ...pgBody, 
      totalRooms: 0,
      totalBeds: 0,
      occupiedBeds: 0,
      emptyBeds: 0,
      isDeleted: false 
    });

    // Auto-create or append Employee staff record for the assigned manager
    if (pg.managerId) {
      const existing = await Employee.findOne({ userId: pg.managerId, isDeleted: false });
      if (existing) {
        if (!existing.pgIds.some(id => String(id) === String(pg._id))) {
          existing.pgIds.push(pg._id);
          existing.status = "active";
          await existing.save();
        }
      } else {
        await Employee.create({
          userId: pg.managerId,
          pgIds: [pg._id],
          joinedDate: new Date(),
          monthlySalary: 0, // default 0, owner can edit
          status: "active",
          addedBy: pg.ownerId
        }).catch(err => console.error("Error auto-creating manager employee record:", err));
      }
    }

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
      .populate("managerId", "name")
      .lean();

    // Resolve S3 image keys to signed GET URLs
    for (const pg of pgs) {
      if (pg.images && pg.images.length > 0) {
        pg.images = await Promise.all(pg.images.map(img => awsService.getFileUrl(img)));
      }
      if (pg.paymentQrKey) {
        pg.paymentQrUrl = await awsService.getFileUrl(pg.paymentQrKey);
      } else {
        pg.paymentQrUrl = null;
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
    if (pg.paymentQrKey) {
      pg.paymentQrUrl = await awsService.getFileUrl(pg.paymentQrKey);
    } else {
      pg.paymentQrUrl = null;
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
    const oldPg = await PG.findOne({ _id: pgId, $or: [{ ownerId: staffId }, { managerId: staffId }], isDeleted: false });
    if (!oldPg) {
      throw new ApiError(httpStatus.NOT_FOUND, "PG not found or access denied");
    }

    // Normalize image urls to keys and delete orphaned S3 files
    if (updateBody.images) {
      updateBody.images = updateBody.images.map(extractS3Key);
      if (oldPg.images) {
        const removedImages = oldPg.images.filter(img => !updateBody.images.includes(img));
        for (const img of removedImages) {
          await awsService.deleteFile(img).catch(() => {});
        }
      }
    }

    if (updateBody.hasOwnProperty('paymentQrKey')) {
      updateBody.paymentQrKey = extractS3Key(updateBody.paymentQrKey);
      if (oldPg.paymentQrKey && oldPg.paymentQrKey !== updateBody.paymentQrKey) {
        await awsService.deleteFile(oldPg.paymentQrKey).catch(() => {});
      }
    }

    // User will pass only updated data in address
    if (updateBody.address) {
      Object.keys(updateBody.address).forEach((key) => {
        updateBody[`address.${key}`] = updateBody.address[key];
      });
      delete updateBody.address;
    }

    // Prevent manual update of computed stats fields
    delete updateBody.totalRooms;
    delete updateBody.totalBeds;
    delete updateBody.occupiedBeds;
    delete updateBody.emptyBeds;

    const pg = await PG.findOneAndUpdate(
      { _id: pgId, $or: [{ ownerId: staffId }, { managerId: staffId }], isDeleted: false },
      { $set: updateBody },
      { runValidators: true, new: true }, // validate data before updating data in DB
    );

    if (!pg) {
      throw new ApiError(httpStatus.NOT_FOUND, "PG not found or access denied");
    }

    // Sync manager staff records if changing
    const oldManagerId = oldPg.managerId?.toString();
    const newManagerId = updateBody.managerId?.toString();
    if (newManagerId && oldManagerId !== newManagerId) {
      // 1. Remove PG ID from old manager's pgIds list
      if (oldManagerId) {
        const oldManager = await Employee.findOne({ userId: oldManagerId, isDeleted: false });
        if (oldManager) {
          oldManager.pgIds = oldManager.pgIds.filter(id => String(id) !== String(pgId));
          if (oldManager.pgIds.length === 0) {
            oldManager.status = "inactive";
          }
          await oldManager.save().catch(() => {});
        }
      }

      // 2. Append PG ID to new manager's pgIds list
      const existing = await Employee.findOne({ userId: newManagerId, isDeleted: false });
      if (existing) {
        if (!existing.pgIds.some(id => String(id) === String(pgId))) {
          existing.pgIds.push(pgId);
        }
        existing.status = "active";
        await existing.save();
      } else {
        await Employee.create({
          userId: newManagerId,
          pgIds: [pgId],
          joinedDate: new Date(),
          monthlySalary: 0,
          status: "active",
          addedBy: staffId,
        }).catch(() => {});
      }
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
      query.$or = [
        { name: { $regex: filter.city, $options: 'i' } },
        { pgDisplayId: { $regex: filter.city, $options: 'i' } },
        { 'address.city': { $regex: filter.city, $options: 'i' } },
        { 'address.state': { $regex: filter.city, $options: 'i' } },
        { 'address.landmark': { $regex: filter.city, $options: 'i' } }
      ];
    }
    if (filter.pgType) {
      query.pgType = filter.pgType;
    }
    if (filter.facilities && filter.facilities.length > 0) {
      query.facilities = { $all: filter.facilities };
    }
    if (filter.minRating) {
      query.rating = { $gte: Number(filter.minRating) };
    }
    if (filter.onlyWithVacancy === 'true' || filter.onlyWithVacancy === true) {
      query.emptyBeds = { $gt: 0 };
    }
    if (filter.latitude && filter.longitude) {
      query.location = {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [Number(filter.longitude), Number(filter.latitude)]
          }
        }
      };
      if (filter.radius) {
        query.location.$near.$maxDistance = Number(filter.radius);
      }
    }

    const pgs = await PG.find(query)
      .limit(limit)
      .skip(skip)
      .select("name pgDisplayId address.city address.state pgType totalRooms totalBeds emptyBeds occupiedBeds rating numReviews facilities images location upiId paymentQrKey")
      .populate("facilities", "name")
      .lean();

    // Resolve S3 image keys to signed GET URLs and calculate distances
    for (const pg of pgs) {
      if (pg.images && pg.images.length > 0) {
        pg.images = await Promise.all(pg.images.map(img => awsService.getFileUrl(img)));
      }
      if (pg.paymentQrKey) {
        pg.paymentQrUrl = await awsService.getFileUrl(pg.paymentQrKey);
      } else {
        pg.paymentQrUrl = null;
      }
      if (filter.latitude && filter.longitude && pg.location?.coordinates) {
        const [lon2, lat2] = pg.location.coordinates;
        pg.distanceKm = getDistanceKm(Number(filter.latitude), Number(filter.longitude), lat2, lon2);
      }
    }

    const countQuery = { ...query };
    if (countQuery.location && countQuery.location.$near) {
      const nearQuery = countQuery.location.$near;
      const coordinates = nearQuery.$geometry.coordinates;
      if (nearQuery.$maxDistance) {
        countQuery.location = {
          $geoWithin: {
            $centerSphere: [coordinates, nearQuery.$maxDistance / 6378100]
          }
        };
      } else {
        delete countQuery.location;
      }
    }
    const total = await PG.countDocuments(countQuery);

    return { pgs, total, limit, page };
  } catch (error) {
    console.error("Error in discoverPGs:", error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Failed to discover PGs: ${error.message}`);
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

const getPgOccupancyStats = async (pgId) => {
  const [rooms, beds] = await Promise.all([
    Room.find({ pgId, isDeleted: false }),
    Bed.find({ pgId, isDeleted: false })
  ]);

  // Calculate price range of available beds
  const availableBeds = beds.filter(b => b.status === "available");
  let minPrice = 0;
  let maxPrice = 0;
  if (availableBeds.length > 0) {
    minPrice = availableBeds[0].price;
    maxPrice = availableBeds[0].price;
    for (const bed of availableBeds) {
      if (bed.price < minPrice) minPrice = bed.price;
      if (bed.price > maxPrice) maxPrice = bed.price;
    }
  }

  // Helper to map sharingType number to occupancy label string
  const getOccupancyLabel = (sharingType) => {
    if (sharingType === 1) return 'single';
    if (sharingType === 2) return 'double';
    if (sharingType === 3) return 'triple';
    if (sharingType === 4) return 'four';
    return 'other';
  };

  const allOccupancies = new Set();
  const availableOccupancies = new Set();
  const roomCountsBySharingType = { single: 0, double: 0, triple: 0, four: 0, other: 0 };
  const availableBedsBySharingType = { single: 0, double: 0, triple: 0, four: 0, other: 0 };

  // Track room occupancy types
  for (const room of rooms) {
    const label = getOccupancyLabel(room.sharingType);
    allOccupancies.add(label);
    roomCountsBySharingType[label]++;

    // Check if this room has available beds
    const roomBeds = beds.filter(b => b.roomId.toString() === room._id.toString() && b.status === "available");
    if (roomBeds.length > 0) {
      availableOccupancies.add(label);
      availableBedsBySharingType[label] += roomBeds.length;
    }
  }

  return {
    minPrice,
    maxPrice,
    emptyBeds: availableBeds.length,
    allOccupancies: Array.from(allOccupancies),
    availableOccupancies: Array.from(availableOccupancies),
    roomCountsBySharingType,
    availableBedsBySharingType
  };
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
  getPgOccupancyStats,
};
