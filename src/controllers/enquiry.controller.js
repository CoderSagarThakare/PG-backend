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
    userName: req.query.userName || '',
  };

  const result = await enquiryService.queryEnquiries(req.user, {
    ...options,
    status: req.query.status,
    pgId: req.query.pgId,
    postId: req.query.postId
  });
  return sendResponse(res, {
    success: true,
    message: "Enquiries fetched successfully",
    data: result,
    statusCode: httpStatus.OK,
  });
});

const getEnquiry = catchAsync(async (req, res) => {
  const enquiry = await enquiryService.getEnquiryById(req.params.enquiryId, req.user._id);
  if (!enquiry) {
    throw new ApiError(httpStatus.NOT_FOUND, "Enquiry not found");
  }


  return sendResponse(res, {
    success: true,
    message: "Enquiry fetched successfully",
    data: { enquiry },
    statusCode: httpStatus.OK,
  });
});

const updateEnquiry = catchAsync(async (req, res) => {

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
