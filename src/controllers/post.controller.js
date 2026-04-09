const catchAsync = require("../utils/catchAsync");
const { postService, PgService } = require("../services");
const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");

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
  };

  const post = await postService.createPost(postData);

  res.status(httpStatus.CREATED).json({
    success: true,
    data: post,
    message: "Vacancy post created successfully",
  });
});

const getPosts = catchAsync(async (req, res) => {
  const options = {
    limit: req.query.limit || 10,
    page: req.query.page || 1,
    sortBy: req.query.sortBy,
  };

  // Filter posts by the current owner (Owner only sees their own ads)
  // const filter = { ownerId: req.user.id };

  // Optional: Filter by specific PG if pgId is in query
  if (req.query.pgId) filter.pgId = req.query.pgId;

  const result = await postService.queryPosts(filter, options);
  res.status(httpStatus.OK).json({
    status: true,
    message: "All post fetched successfully",
    ...result,
  });
});

const getPost = catchAsync(async (req, res) => {
  const post = await postService.getPostById(req.params.postId, req.user._id);

  res
    .status(httpStatus.OK)
    .json({ success: true, message: "Post fetched successfully", post });
});

const updatePost = catchAsync(async (req, res) => {
  await postService.updatePostById(req.params.postId, req.body, req.user._id);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Post updated successfully",
  });
});

// for regular users: get recommendations based on preferences
const getPostsByPreference = catchAsync(async (req, res) => {
  const options = {
    limit: req.query.limit || 10,
    page: req.query.page || 1,
  };

  const result = await postService.getPostsByPreference(req.user._id, options);
  res.status(httpStatus.OK).json(result);
});

const deletePost = catchAsync(async (req, res) => {
  // Pass userId to service to ensure only owner can delete
  await postService.deletePostById(req.params.postId, req.user._id);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Post deleted successfully",
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
