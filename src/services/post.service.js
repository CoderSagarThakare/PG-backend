const { Post, PG } = require("../models");
const userPreferenceService = require("./userPreference.service");
const ApiError = require("../utils/ApiError");
const httpStatus = require("http-status");

/**
 * Create a Vacancy Post
 * @param {Object} postBody
 * @returns {Promise<Post>}
 */
const createPost = async (postBody) => {
  try {
    // Ensuring default flags are set correctly on creation
    const post = await Post.create({
      ...postBody,
    });

    return post;
  } catch (error) {
    console.log({ error });
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to create post",
    );
  }
};

/**
 * Query for posts with pagination
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @returns {Promise<QueryResult>}
 */
const queryPosts = async (filter, options = {}) => {
  try {
    const limit = parseInt(options.limit, 10) || 10;
    const page = parseInt(options.page, 10) || 1;
    const skip = (page - 1) * limit;

    // IMPORTANT: Always exclude soft-deleted posts from results
    const finalFilter = {
      ...filter,
      isDeleted: false,
    };

    const posts = await Post.find(finalFilter)
      .populate("pgId", "name address locationLink")
      .sort(options.sortBy || "-createdAt")
      .limit(limit)
      .skip(skip)
      .populate("ownerId", "name mobNo1 mobNo2 role email picture")
      .populate("managerId", "name mobNo1 mobNo2 role email picture")
      .populate("createdBy", "name role")
      .populate("pgId", "name rating checkInTime checkOutTime")
      .populate("facilities");

    const total = await Post.countDocuments(finalFilter);

    return { posts, total, limit, page };
  } catch (error) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to retrieve posts",
    );
  }
};

/**
 * Get Post by ID
 * @param {string} postId
 * @returns {Promise<Post>}
 */
const getPostById = async (postId, staffId) => {
  const post = await Post.findOne({ _id: postId })
    .populate("pgId", "name rating checkInTime checkOutTime")
    .populate("ownerId", "name mobNo1 mobNo2 role email picture")
    .populate("managerId", "name mobNo1 mobNo2 role email picture")
    .populate("facilities")
    .populate("createdBy", "name");

  if (!post) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      "Post not found or has been deleted",
    );
  }

  return post;
};

/**
 * Update Post by ID
 * @param {string} postId
 * @param {string} ownerId - For verification
 * @param {Object} updateBody
 * @returns {Promise<Post>}
 */
const updatePostById = async (postId, updateBody, staffId) => {
  const post = await Post.findOne({ _id: postId }).populate(
    "pgId",
    "managerId ownerId",
  );

  if (!post) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      "Post not found, unauthorized, or deleted",
    );
  }

  const isOwner = post.pgId.ownerId.toString() === staffId.toString();
  const isManager =
    post.pgId.managerId &&
    post.pgId.managerId.toString() === staffId.toString();

  if (!isOwner && !isManager) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Access Denied: You are not authorized to view this post.",
    );
  }

  Object.assign(post, updateBody);
  await post.save();
  return post;
};

/**
 * Delete Post by ID (Soft Delete)
 * @param {string} postId
 * @param {string} ownerId - For verification
 * @returns {Promise<void>}
 */
const deletePostById = async (postId, staffId) => {
  try {
    const post = await Post.findOne({ _id: postId }).populate(
      "pgId",
      "ownerId managerId",
    );

    if (!post) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "Post not found or already deleted",
      );
    }

    const isOwner = post.pgId.ownerId.toString() === staffId.toString();
    const isManager =
      post.pgId.managerId &&
      post.pgId.managerId.toString() === staffId.toString();

    if (!isOwner && !isManager) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Access Denied: You are not authorized to view this post.",
      );
    }

    // Set isDeleted to true and isActive to false so it disappears from public feeds
    await Post.updateOne({ _id: postId }, { isDeleted: true, isActive: false });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to delete post",
    );
  }
};

/**
 * Fetch vacancy posts tailored to a user's preferences with scoring and pagination.
 * @param {string} userId
 * @param {Object} options - { limit, page }
 * @returns {Promise<QueryResult>}
 */
const getPostsByPreference = async (userId, options = {}) => {
  const pref = await userPreferenceService.getPreferenceByUserId(userId);
  const limit = parseInt(options.limit, 10) || 10;
  const page = parseInt(options.page, 10) || 1;
  const skip = (page - 1) * limit;

  if (!pref) {
    return { posts: [], total: 0, limit, page };
  }

  // build PG filter first (for geo / pincode)
  const pgFilter = { isActive: true, isDeleted: false };
  if (pref.location) {
    if (pref.location.pincode) {
      pgFilter["address.pincode"] = pref.location.pincode;
    }
    if (
      pref.location.coordinates &&
      Array.isArray(pref.location.coordinates) &&
      pref.location.coordinates.length === 2
    ) {
      pgFilter.location = {
        $near: {
          $geometry: { type: "Point", coordinates: pref.location.coordinates },
          $maxDistance: pref.location.radius || 5000,
        },
      };
    }
    if (pref.location.city) {
      pgFilter["address.city"] = pref.location.city;
    }
  }

  // find matching PG ids
  const pgDocs = await PG.find(pgFilter).select("_id facilities");
  const pgIds = pgDocs.map((p) => p._id);

  // build post filter
  const postFilter = {
    isDeleted: false,
    isActive: true,
    pgId: { $in: pgIds },
  };
  if (pref.pgType) {
    postFilter.gender = pref.pgType;
  }

  // initial fetch without scoring (just to get total count)
  const total = await Post.countDocuments(postFilter);

  // fetch actual posts, populate for scoring
  let posts = await Post.find(postFilter)
    .populate("pgId", "name address facilities location")
    .limit(limit)
    .skip(skip);

  // compute scores
  const now = Date.now();
  posts = posts
    .map((post) => {
      let score = 0;
      // pincode match
      if (
        pref.location &&
        pref.location.pincode &&
        post.pgId.address &&
        post.pgId.address.pincode === pref.location.pincode
      ) {
        score += 50;
      }
      // budget match (assume pricePerBed <= budget)
      if (pref.budget !== undefined && post.pricePerBed <= pref.budget) {
        score += 30;
      }
      // facilities match
      if (pref.facilities && pref.facilities.length && post.pgId.facilities) {
        const matched = post.pgId.facilities.filter((f) =>
          pref.facilities.includes(String(f)),
        );
        score += matched.length * 10;
      }
      // recency: created within last 7 days
      const created = new Date(post.createdAt).getTime();
      const ageDays = (now - created) / (1000 * 60 * 60 * 24);
      if (ageDays <= 7) {
        score += 20;
      }

      return { post, score };
    })
    .sort((a, b) => b.score - a.score || b.post.createdAt - a.post.createdAt)
    .map((p) => p.post);

  return { posts, total, limit, page };
};

module.exports = {
  createPost,
  queryPosts,
  getPostById,
  updatePostById,
  deletePostById,
  getPostsByPreference,
};
