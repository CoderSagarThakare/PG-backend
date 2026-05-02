const { Enquiry, PG, Post, Staff } = require("../models");
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
    const owner = await Staff.findById(enquiry.ownerId).select(
      "name mobNo1 mobNo2",
    );
    const manager = enquiry.managerId
      ? await Staff.findById(enquiry.managerId).select("name mobNo1 mobNo2")
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
const queryEnquiries = async (filter, options) => {
  const limit = Number(options.limit) || 10;
  const page = Number(options.page) || 1;
  const skip = (page - 1) * limit;
  const query = { ...filter };

const enquiries = await Enquiry.find(query)
  .limit(limit)
  .skip(skip)
  .sort(options.sortBy)
  .populate("userId", "name email picture mobNo1 mobNo2") 
  .populate("pgId", "name") 
  .populate("postId", "title occupancyType pricePerBed")
  .populate("ownerId", "name mobNo1 mobNo2")
  .populate("managerId", "name mobNo1 mobNo2")
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
const getEnquiryById = async (id, userId) => {
  return Enquiry.findOne({ 
    _id: id,
    $or: [
      { ownerId: userId },
      { managerId: userId },
      { userId: userId }
    ]
  });
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

  // No need for additional access check since getEnquiryById already filters by access

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
