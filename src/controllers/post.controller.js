const catchAsync = require("../utils/catchAsync");
const { postService, PgService } = require("../services");
const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const sendResponse = require("../utils/sendResponse");

const createPost = catchAsync(async (req, res) => {
  // 1. Verify PG belongs to this owner/manager
  const pg = await PgService.getPGById(req.body.pgId, req.user.id);
  if (!pg) throw new ApiError(httpStatus.NOT_FOUND, "PG not found or Access denied");

  // 2. Vacancy count must not exceed actual empty beds
  const requestedTotal = req.body.pgType === 'unisex'
    ? (Number(req.body.maleVacancyCount) || 0) + (Number(req.body.femaleVacancyCount) || 0)
    : Number(req.body.vacancyCount) || 0;

  if (requestedTotal > pg.emptyBeds) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Total vacancy count (${requestedTotal}) cannot exceed the number of empty beds in this PG (${pg.emptyBeds}).`,
    );
  }

  // 3. Denormalize PG location/address into the post
  const postData = {
    ...req.body,
    location: pg.location,
    address: { pincode: pg.address.pincode, city: pg.address.city },
    facilities: pg.facilities,
    createdBy: req.user.id,
    managerId: pg.managerId,
    ownerId: pg.ownerId,
  };

  const post = await postService.createPost(postData);
  sendResponse(res, {
    success: true,
    data: post,
    message: "Vacancy post created successfully",
    statusCode: httpStatus.CREATED,
  });
});

const getPosts = catchAsync(async (req, res) => {
  const options = {
    limit: req.query.limit || 10,
    page: req.query.page || 1,
    sortBy: req.query.sortBy,
  };

  const result = await postService.queryPosts(req.user._id, { 
    ...options, 
    pgId: req.query.pgId 
  });
  sendResponse(res, {
    success: true,
    message: "All post fetched successfully",
    data: result,
    statusCode: httpStatus.OK,
  });
});

const getPost = catchAsync(async (req, res) => {
  const post = await postService.getPostById(req.params.postId, req.user._id);

  sendResponse(res, {
    success: true,
    message: "Post fetched successfully",
    data: { post },
    statusCode: httpStatus.OK,
  });
});

const updatePost = catchAsync(async (req, res) => {
  // Fetch the existing post to know which PG it belongs to
  const existingPost = await postService.getPostById(req.params.postId, req.user._id);
  const pg = await PgService.getPGById(existingPost.pgId._id || existingPost.pgId, req.user.id);

  if (pg) {
    // Determine the requested total from the update body (fall back to current post values)
    const isUnisex = (req.body.pgType || existingPost.pgType) === 'unisex';
    
    const getUpdateValue = (val, fallback) => (val !== undefined && val !== null ? Number(val) : fallback);

    const maleVal = getUpdateValue(req.body.maleVacancyCount, existingPost.maleVacancyCount);
    const femaleVal = getUpdateValue(req.body.femaleVacancyCount, existingPost.femaleVacancyCount);
    const vacancyVal = getUpdateValue(req.body.vacancyCount, existingPost.vacancyCount);

    const requestedTotal = isUnisex ? ((maleVal || 0) + (femaleVal || 0)) : (vacancyVal || 0);

    if (requestedTotal > pg.emptyBeds) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Total vacancy count (${requestedTotal}) cannot exceed the number of empty beds in this PG (${pg.emptyBeds}).`,
      );
    }
  }

  await postService.updatePostById(req.params.postId, req.body, req.user._id);
  sendResponse(res, {
    success: true,
    message: "Post updated successfully",
    statusCode: httpStatus.OK,
  });
});

// for regular users: get recommendations based on preferences
const getPostsByPreference = catchAsync(async (req, res) => {
  const options = {
    ...req.query,
    limit: req.query.limit || 10,
    page: req.query.page || 1,
  };

  const userId = req.user ? (req.user._id || req.user.id) : null;
  const result = await postService.getPostsByPreference(userId, options);
  sendResponse(res, { data: result, statusCode: httpStatus.OK });
});

const deletePost = catchAsync(async (req, res) => {
  // Pass userId to service to ensure only owner can delete
  await postService.deletePostById(req.params.postId, req.user._id);

  sendResponse(res, {
    success: true,
    message: "Post deleted successfully",
    statusCode: httpStatus.OK,
  });
});

const getPostImageUploadUrl = catchAsync(async (req, res) => {
  const { fileName, fileType } = req.query;
  if (!fileName || !fileType) {
    return res.status(httpStatus.BAD_REQUEST).json({ message: "fileName and fileType are required" });
  }

  const { awsService } = require("../services");
  const { uploadUrl, key } = await awsService.getPostShowcaseUploadUrl(fileName, fileType);
  sendResponse(res, { data: { uploadUrl, key }, statusCode: httpStatus.OK });
});

const deletePostImageFile = catchAsync(async (req, res) => {
  const { key } = req.body;
  if (!key) {
    return res.status(httpStatus.BAD_REQUEST).json({ message: "key is required" });
  }

  // Security check: only allow deleting files under public/posts/
  if (!key.startsWith("public/posts/")) {
    return res.status(httpStatus.BAD_REQUEST).json({ message: "Invalid key prefix or permission denied" });
  }

  const { awsService } = require("../services");
  await awsService.deleteFile(key);
  sendResponse(res, { success: true, message: "File deleted successfully from S3", statusCode: httpStatus.OK });
});

module.exports = {
  createPost,
  getPosts,
  getPost,
  updatePost,
  deletePost,
  getPostsByPreference,
  getPostImageUploadUrl,
  deletePostImageFile,
};
