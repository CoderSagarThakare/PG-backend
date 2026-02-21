const { Post } = require("../models");
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
    return await Post.create({
      ...postBody,
      isDeleted: false,
      isActive: true,
    });
  } catch (error) {
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
      .skip(skip);

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
const getPostById = async (postId) => {
  // Check for isDeleted: false to ensure we don't retrieve a deleted post via ID
  const post = await Post.findOne({ _id: postId, isDeleted: false })

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
const updatePostById = async (postId, ownerId, updateBody) => {
  // Ensure we are only updating a post that is NOT deleted
  const post = await Post.findOne({ _id: postId, ownerId, isDeleted: false });

  if (!post) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      "Post not found, unauthorized, or deleted",
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
const deletePostById = async (postId, ownerId) => {
  try {
    const post = await Post.findOne({ _id: postId, ownerId, isDeleted: false });

    if (!post) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "Post not found or already deleted",
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

module.exports = {
  createPost,
  queryPosts,
  getPostById,
  updatePostById,
  deletePostById,
};
