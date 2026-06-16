const { Post, PG, Enquiry } = require("../models");
const userPreferenceService = require("./userPreference.service");
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

/**
 * Create a Vacancy Post
 * @param {Object} postBody
 * @returns {Promise<Post>}
 */
const createPost = async (postBody) => {
  try {
    if (postBody.images) {
      postBody.images = postBody.images.map(extractS3Key);
    }

    // Enforce one active post per PG
    const existing = await Post.findOne({ pgId: postBody.pgId, isDeleted: false });
    if (existing) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'This PG already has an active vacancy post. Edit or delete the existing one first.',
      );
    }

    // For unisex PGs: compute vacancyCount from male + female split
    if (postBody.pgType === 'unisex') {
      const male   = Number(postBody.maleVacancyCount)   || 0;
      const female = Number(postBody.femaleVacancyCount) || 0;
      if (male === 0 && female === 0) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          'Please specify Male and/or Female vacancy count for a Unisex PG.',
        );
      }
      postBody.maleVacancyCount   = male;
      postBody.femaleVacancyCount = female;
      postBody.vacancyCount       = male + female;
    } else {
      // Non-unisex: vacancyCount is required
      if (!postBody.vacancyCount && postBody.vacancyCount !== 0) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'vacancyCount is required.');
      }
      // Keep male/female counts null for non-unisex
      postBody.maleVacancyCount   = null;
      postBody.femaleVacancyCount = null;
    }

    const post = await Post.create({ ...postBody });
    return post;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to create post',
    );
  }
};

/**
 * Query for posts with pagination
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @returns {Promise<QueryResult>}
 */
const queryPosts = async (staffId, options = {}) => {
  try {
    const limit = parseInt(options.limit, 10) || 10;
    const page = parseInt(options.page, 10) || 1;
    const skip = (page - 1) * limit;

    // 1. Find all PGs where this staff is either the current owner or current manager
    const managedPGs = await PG.find({
      $or: [{ ownerId: staffId }, { managerId: staffId }],
      isDeleted: false,
    }).select("_id");

    const pgIds = managedPGs.map((pg) => pg._id);

    // 2. Build filter based on these PG IDs
    const finalFilter = {
      pgId: { $in: pgIds },
      isDeleted: false,
    };

    // If a specific pgId was requested in options, narrow it down
    if (options.pgId) {
      finalFilter.pgId = options.pgId;
    }

    const posts = await Post.find(finalFilter)
      .populate("pgId", "name address locationLink rating checkInTime checkOutTime")
      .sort(options.sortBy || "-createdAt")
      .limit(limit)
      .skip(skip)
      .populate("createdBy", "name role")
      .populate("facilities");

    // Resolve S3 image keys to signed GET URLs
    for (const post of posts) {
      if (post.images && post.images.length > 0) {
        post.images = await Promise.all(post.images.map(img => awsService.getFileUrl(img)));
      }
    }

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

  // Resolve S3 image keys to signed GET URLs
  if (post.images && post.images.length > 0) {
    post.images = await Promise.all(post.images.map(img => awsService.getFileUrl(img)));
  }

  return post;
};

/**
 * Update Post by ID
 * @param {string} postId
 * @param {string} staffId - For verification
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

  // Normalize image urls to keys and delete S3 orphaned files
  if (updateBody.images) {
    updateBody.images = updateBody.images.map(extractS3Key);
    try {
      const oldPost = await Post.findById(postId);
      if (oldPost && oldPost.images) {
        const removedImages = oldPost.images.filter(img => !updateBody.images.includes(img));
        for (const img of removedImages) {
          await awsService.deleteFile(img).catch(() => {});
        }
      }
    } catch (e) {
      console.error("Error cleaning S3 vacancy post images:", e);
    }
  }

  Object.assign(post, updateBody);
  await post.save();
  return post;
};

/**
 * Delete Post by ID (Soft Delete)
 * @param {string} postId
 * @param {string} staffId - For verification
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
 * Sync vacancy counts on a PG's active post after a bed assign / unassign.
 * Called by room.service — fails silently if no post exists for the PG.
 *
 * @param {ObjectId|string} pgId
 * @param {Object}          opts
 * @param {string}          opts.userGender  - 'male' | 'female' | 'transgender' | 'preferNotToSay'
 * @param {number}          opts.delta       - -1 (assign) or +1 (unassign)
 */
const syncPostVacancy = async (pgId, { userGender, delta }) => {
  try {
    const post = await Post.findOne({ pgId, isDeleted: false });
    if (!post) return; // No vacancy post for this PG — silently skip

    if (post.pgType === 'unisex') {
      // For unisex track male and female separately
      if (userGender === 'male') {
        post.maleVacancyCount = Math.max(0, (post.maleVacancyCount || 0) + delta);
      } else if (userGender === 'female') {
        post.femaleVacancyCount = Math.max(0, (post.femaleVacancyCount || 0) + delta);
      }
      // Recompute total
      post.vacancyCount = (post.maleVacancyCount || 0) + (post.femaleVacancyCount || 0);
    } else {
      // male / female / coLiving — single counter
      post.vacancyCount = Math.max(0, post.vacancyCount + delta);
    }

    // Auto-deactivate when all vacancies filled
    if (post.vacancyCount === 0) {
      post.isActive = false;
    }
    // NOTE: never auto-reactivate — owner must manually turn it back on

    await post.save();
  } catch (err) {
    // Non-critical — log but do not block the bed assignment flow
    console.error('[syncPostVacancy] Error syncing post vacancy for pgId', pgId, err.message);
  }
};

/**
 * Fetch vacancy posts tailored to a user's preferences with scoring and pagination.
 * @param {string} userId
 * @param {Object} options - { limit, page }
 * @returns {Promise<QueryResult>}
 */
const getPostsByPreference = async (userId, options = {}) => {
  let pref = {};
  try {
    pref = await userPreferenceService.getPreferenceByUserId(userId);
  } catch (error) {
    // If preference doesn't exist, the service throws a 404. 
    // We catch it and just use the empty pref object to show all posts.
  }
  const limit = parseInt(options.limit, 10) || 10;
  const page = parseInt(options.page, 10) || 1;
  const skip = (page - 1) * limit;

  // build PG filter first (for geo / pincode)
  const pgFilter = { isActive: true, isDeleted: false };
  if (options.pgId) {
    pgFilter._id = options.pgId;
  } else if (options.latitude && options.longitude) {
    pgFilter.location = {
      $near: {
        $geometry: { 
          type: "Point", 
          coordinates: [Number(options.longitude), Number(options.latitude)] 
        },
        $maxDistance: Number(options.radius) || 15000
      }
    };
  } else if (options.city) {
    pgFilter["address.city"] = { $regex: new RegExp(options.city, "i") };
  } else if (pref.location) {
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

  if (options.facilities) {
    const facArray = Array.isArray(options.facilities)
      ? options.facilities
      : typeof options.facilities === 'string'
        ? options.facilities.split(',').map(f => f.trim()).filter(Boolean)
        : [];
    if (facArray.length > 0) {
      pgFilter.facilities = { $all: facArray };
    }
  }

  if (options.minRating) {
    pgFilter.rating = { $gte: Number(options.minRating) };
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

  if (options.pgType) {
    postFilter.pgType = options.pgType;
  } else if (pref.pgType && !options.pgId) {
    postFilter.pgType = pref.pgType;
  }

  if (options.occupancyType) {
    postFilter.occupancyType = options.occupancyType;
  }

  if (options.title) {
    postFilter.title = { $regex: new RegExp(options.title, "i") };
  }

  if (options.minPrice || options.maxPrice) {
    if (options.minPrice) {
      postFilter.minPrice = { $gte: Number(options.minPrice) };
    }
    if (options.maxPrice) {
      postFilter.maxPrice = { $lte: Number(options.maxPrice) };
    }
  }

  if (options.onlyWithVacancy === 'true' || options.onlyWithVacancy === true) {
    postFilter.vacancyCount = { $gt: 0 };
  }

  // initial fetch without scoring (just to get total count)
  const total = await Post.countDocuments(postFilter);

  // fetch actual posts, project only necessary fields for UI & scoring
  let posts = await Post.find(postFilter)
    .select("title description vacancyCount occupancyType pgType minPrice maxPrice pgId createdAt images maleVacancyCount femaleVacancyCount")
    .populate({
      path: "pgId",
      select: "name address checkInTime checkOutTime facilities rating location",
      populate: { path: "facilities", select: "name" }
    })
    .limit(limit)
    .skip(skip)
    .lean();

  // Resolve S3 image keys to signed GET URLs
  for (const post of posts) {
    if (post.images && post.images.length > 0) {
      post.images = await Promise.all(post.images.map(img => awsService.getFileUrl(img)));
    }
  }

  // compute scores
  const now = Date.now();
  posts = posts
    .map((post) => {
      let score = 0;

      // calculate and attach distance in km if user coordinates are provided
      if (options.latitude && options.longitude && post.pgId?.location?.coordinates) {
        const [lon2, lat2] = post.pgId.location.coordinates;
        const dist = getDistanceKm(Number(options.latitude), Number(options.longitude), lat2, lon2);
        post.distanceKm = dist;
        if (dist <= 2) score += 55;
        else if (dist <= 5) score += 35;
        else if (dist <= 10) score += 15;
      }
      // fallback to user preference location coordinates
      else if (
        pref.location &&
        pref.location.coordinates &&
        Array.isArray(pref.location.coordinates) &&
        pref.location.coordinates.length === 2 &&
        post.pgId?.location?.coordinates
      ) {
        const [lon2, lat2] = post.pgId.location.coordinates;
        const [lon1, lat1] = pref.location.coordinates;
        const dist = getDistanceKm(lat1, lon1, lat2, lon2);
        post.distanceKm = dist;
        if (dist <= 2) score += 55;
        else if (dist <= 5) score += 35;
        else if (dist <= 10) score += 15;
      }

      // pincode match
      if (
        pref.location &&
        pref.location.pincode &&
        post.pgId.address &&
        post.pgId.address.pincode === pref.location.pincode
      ) {
        score += 50;
      }
      // budget match (assume minPrice <= budget)
      if (pref.budget !== undefined && post.minPrice <= pref.budget) {
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

  // Attach enquiry data for this user
  if (posts.length > 0) {
    const postIds = posts.map((p) => p._id);
    const userEnquiries = await Enquiry.find({ userId, postId: { $in: postIds } })
      .populate("ownerId", "name mobNo1 mobNo2")
      .populate("managerId", "name mobNo1 mobNo2")
      .lean();

    const enqMap = {};
    userEnquiries.forEach((e) => {
      enqMap[e.postId.toString()] = { owner: e.ownerId, manager: e.managerId, enquiryId: e._id, status: e.status };
    });

    posts.forEach((p) => {
      if (enqMap[p._id.toString()]) {
        p.enquiryData = enqMap[p._id.toString()];
      }
    });
  }

  return { posts, total, limit, page };
};

module.exports = {
  createPost,
  queryPosts,
  getPostById,
  updatePostById,
  deletePostById,
  getPostsByPreference,
  syncPostVacancy,
};
