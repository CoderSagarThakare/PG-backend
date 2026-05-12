const catchAsync = require("../utils/catchAsync");
const { postService, PgService } = require("../services");
const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const sendResponse = require("../utils/sendResponse");

const createPost = catchAsync(async (req, res) => {
  // 1. Check if the PG belongs to the logged-in owner

  const pg = await PgService.getPGById(req.body.pgId, req.user.id);

  if (!pg) {
    throw new ApiError(httpStatus.NOT_FOUND, "PG not found or Access denied");
  }

  if (req.body.vacancyCount > pg.emptyBeds) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Only ${pg.emptyBeds} beds are currently empty in this PG.`,
    );
  }

  // 3. Denormalization: Copying PG location/address to PostData
  const postData = {
    ...req.body,
    location: pg.location,
    address: {
      pincode: pg.address.pincode,
      city: pg.address.city,
    },
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

  const result = await postService.getPostsByPreference(req.user._id, options);
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

module.exports = {
  createPost,
  getPosts,
  getPost,
  updatePost,
  deletePost,
  getPostsByPreference,
};
