const { Enquiry, PG, Post, User, Onboarding } = require("../models");
const ApiError = require("../utils/ApiError");
const httpStatus = require("http-status");

const getActivePostById = async (postId) => {
  const post = await Post.findOne({ _id: postId, isActive: true });

  if (!post) {
    throw new ApiError(httpStatus.NOT_FOUND, "Post not found or inactive");
  }
  return post;
};

const getPgById = async (pgId) => {
  const pg = await PG.findOne({ _id: pgId, isDeleted: false }).select(
    "ownerId managerId",
  );
  if (!pg) {
    throw new ApiError(httpStatus.NOT_FOUND, "PG not found");
  }
  return pg;
};

/**
 * Create an enquiry
 * @param {Object} enquiryBody
 * @param {ObjectId} enquiryBody.userId
 * @param {ObjectId} enquiryBody.postId
 * @returns {Promise<Enquiry>}
 */
const createEnquiry = async ({ userId, postId }) => {
  try {
    const post = await getActivePostById(postId);
    const pg = await getPgById(post.pgId);

    const existingEnquiry = await Enquiry.findOne({
      userId,
      postId,
    });

    if (existingEnquiry) {
      throw new ApiError(
        httpStatus.CONFLICT,
        "You have already shown interest in this post",
      );
    }

    const enquiryBody = {
      userId,
      postId,
      pgId: post.pgId,
      ownerId: pg.ownerId,
      managerId: pg.managerId,
    };

    const enquiry = await Enquiry.create(enquiryBody);

    // Fetch owner and manager mobile numbers
    const owner = await User.findById(enquiry.ownerId).select(
      "name mobNo1 mobNo2",
    );
    const manager = enquiry.managerId
      ? await User.findById(enquiry.managerId).select("name mobNo1 mobNo2")
      : null;

    return {
      owner: owner,
      manager: manager,
      enquiryId: enquiry._id,
      status: enquiry.status
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to create enquiry",
    );
  }
};

/**
 * Query enquiries
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryEnquiries = async (user, options) => {
  const limit = Number(options.limit) || 10;
  const page = Number(options.page) || 1;
  const skip = (page - 1) * limit;
  const userName = options.userName || '';
  
  let query = { isDeleted: false };

  if (user.role === 'user') {
    query.userId = user._id;
  } else {
    // 1. Find all PGs where this staff is either owner or manager
    const managedPGs = await PG.find({
      $or: [{ ownerId: user._id }, { managerId: user._id }],
      isDeleted: false,
    }).select("_id");

    const pgIds = managedPGs.map((pg) => pg._id);
    query.pgId = { $in: pgIds };
  }

  // Optional filters from user
  if (options.status) query.status = options.status;
  if (options.pgId) query.pgId = options.pgId; // already subset of managedPGs or not
  if (options.postId) query.postId = options.postId;

  // If searching by userName, we need to fetch with population then filter
  if (userName) {
    const allEnquiries = await Enquiry.find(query)
      .sort(options.sortBy || { createdAt: -1 })
      .populate("userId", "name email picture mobNo1 mobNo2")
      .populate("pgId", "name")
      .populate({ path: "postId", select: "title occupancyType minPrice maxPrice isDeleted isActive", match: { isDeleted: { $in: [true, false] } } })
      .lean();

    const filtered = allEnquiries.filter(e =>
      e.userId?.name?.toLowerCase().includes(userName.toLowerCase())
    );

    const total = filtered.length;
    const enquiries = filtered.slice(skip, skip + limit);
    return { enquiries, total, limit, page };
  }

  const enquiries = await Enquiry.find(query)
    .limit(limit)
    .skip(skip)
    .sort(options.sortBy || { createdAt: -1 })
    .populate("userId", "name email picture mobNo1 mobNo2")
    .populate("pgId", "name")
    .populate({ path: "postId", select: "title occupancyType minPrice maxPrice isDeleted isActive", match: { isDeleted: { $in: [true, false] } } })
    .lean();

  const total = await Enquiry.countDocuments(query);
  return { enquiries, total, limit, page };
};

/**
 * Get enquiry by id
 * @param {ObjectId} id
 * @param {ObjectId} userId - User ID to check access
 * @returns {Promise<Enquiry>}
 */
const getEnquiryById = async (id, staffId) => {
  const enquiry = await Enquiry.findById(id).populate("pgId", "ownerId managerId");
  if (!enquiry) return null;

  // Check if current staff is linked to the parent PG
  const isOwner = enquiry.pgId?.ownerId?.toString() === staffId.toString();
  const isManager = enquiry.pgId?.managerId?.toString() === staffId.toString();
  const isSelfUser = enquiry.userId?.toString() === staffId.toString();

  if (!isOwner && !isManager && !isSelfUser) return null;
  return enquiry;
};

/**
 * Update enquiry by id
 * @param {ObjectId} enquiryId
 * @param {Object} updateBody
 * @param {ObjectId} staffId - Staff who is updating
 * @returns {Promise<Enquiry>}
 */
const updateEnquiryById = async (enquiryId, updateBody, staffId) => {
  const enquiry = await getEnquiryById(enquiryId, staffId);
  if (!enquiry) {
    throw new ApiError(httpStatus.NOT_FOUND, "Enquiry not found");
  }

  // ── Deal Done gate (runs both checks in parallel for efficiency) ────────────
  if (updateBody.status === "dealDone") {
    const [activeOnboarding, user, pg] = await Promise.all([
      Onboarding.findOne({
        userId: enquiry.userId,
        status: { $ne: "removed" },
        isDeleted: false,
      }).select("_id pgId").lean(),
      User.findById(enquiry.userId).select("gender name").lean(),
      PG.findById(enquiry.pgId).select("pgType name").lean(),
    ]);

    // 1. Block if already onboarded elsewhere
    if (activeOnboarding) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "User is already onboarded at another PG. Offboard them first."
      );
    }

    // 2. Block if user gender is incompatible with the PG type
    if (user && pg) {
      const gender = user.gender;
      const pgType = pg.pgType;

      const pgTypeLabel = { male: "Male-only", female: "Female-only", unisex: "Unisex" };
      const isIncompatible =
        (pgType === "male"   && gender !== "male")   ||
        (pgType === "female" && gender !== "female") ||
        (pgType === "unisex" && !["male", "female"].includes(gender));

      if (!gender) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `${user.name} has no gender set. Ask them to update their profile first.`
        );
      }

      if (isIncompatible) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `${user.name} (${gender}) cannot join a ${pgTypeLabel[pgType] ?? pgType} PG.`
        );
      }
    }
  }

  updateBody.updatedBy = staffId;

  Object.assign(enquiry, updateBody);
  await enquiry.save();
  return enquiry;
};

/**
 * Delete enquiry by id (soft delete)
 * @param {ObjectId} enquiryId
 * @param {ObjectId} staffId
 * @returns {Promise<Enquiry>}
 */
const deleteEnquiryById = async (enquiryId, staffId) => {
  const enquiry = await getEnquiryById(enquiryId, staffId);
  if (!enquiry) {
    throw new ApiError(httpStatus.NOT_FOUND, "Enquiry not found");
  }

  // No need for additional access check since getEnquiryById already filters by access

  await Enquiry.updateOne({ _id: enquiryId }, { isDeleted: true });
};

module.exports = {
  createEnquiry,
  queryEnquiries,
  getEnquiryById,
  updateEnquiryById,
  deleteEnquiryById,
};
