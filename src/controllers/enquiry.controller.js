const catchAsync = require("../utils/catchAsync");
const sendResponse = require("../utils/sendResponse");
const { enquiryService } = require("../services");
const { ROLE_TYPES } = require("../const/constant");
const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");

const createEnquiry = catchAsync(async (req, res) => {
  const result = await enquiryService.createEnquiry({
    userId: req.user._id,
    postId: req.body.postId,
  });

  return sendResponse(res, {
    message: "Enquiry created successfully",
    data: result,
    statusCode: httpStatus.CREATED,
  });
});

const getEnquiries = catchAsync(async (req, res) => {
  const options = {
    limit: req.query.limit || 10,
    page: req.query.page || 1,
    sortBy: req.query.sortBy,
  };

  // Filter enquiries for the current staff (owner or manager)
  const filter = {
    $or: [
      { ownerId: req.user._id },
      { managerId: req.user._id },
      { userId: req.user._id },
    ],
  };

  // Optional filters
  if (req.query.status) filter.status = req.query.status;
  if (req.query.pgId) filter.pgId = req.query.pgId;
  if (req.query.postId) filter.postId = req.query.postId;

  const result = await enquiryService.queryEnquiries(filter, options);
  return sendResponse(res, {
    success: true,
    message: "Enquiries fetched successfully",
    data: result,
    statusCode: httpStatus.OK,
  });
});

const getEnquiry = catchAsync(async (req, res) => {
  if (![ROLE_TYPES.owner, ROLE_TYPES.manager].includes(req.user.role)) {
    throw new ApiError(httpStatus.FORBIDDEN, "Access denied");
  }
  const enquiry = await enquiryService.getEnquiryById(req.params.enquiryId);
  if (!enquiry) {
    throw new ApiError(httpStatus.NOT_FOUND, "Enquiry not found");
  }

  // Check access
  if (
    enquiry.ownerId.toString() !== req.user._id.toString() &&
    enquiry.managerId?.toString() !== req.user._id.toString()
  ) {
    throw new ApiError(httpStatus.FORBIDDEN, "Access denied");
  }

  return sendResponse(res, {
    success: true,
    message: "Enquiry fetched successfully",
    data: enquiry,
    statusCode: httpStatus.OK,
  });
});

const updateEnquiry = catchAsync(async (req, res) => {
  if (![ROLE_TYPES.owner, ROLE_TYPES.manager].includes(req.user.role)) {
    throw new ApiError(httpStatus.FORBIDDEN, "Access denied");
  }
  const enquiry = await enquiryService.updateEnquiryById(
    req.params.enquiryId,
    req.body,
    req.user._id,
  );

  return sendResponse(res, {
    success: true,
    message: "Enquiry updated successfully",
    data: enquiry,
    statusCode: httpStatus.OK,
  });
});

const deleteEnquiry = catchAsync(async (req, res) => {
  if (![ROLE_TYPES.owner, ROLE_TYPES.manager].includes(req.user.role)) {
    throw new ApiError(httpStatus.FORBIDDEN, "Access denied");
  }
  await enquiryService.deleteEnquiryById(req.params.enquiryId, req.user._id);

  return sendResponse(res, {
    success: true,
    message: "Enquiry deleted successfully",
    data: null,
    statusCode: httpStatus.OK,
  });
});

module.exports = {
  createEnquiry,
  getEnquiries,
  getEnquiry,
  updateEnquiry,
  deleteEnquiry,
};
