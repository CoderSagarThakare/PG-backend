const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { roomService, PgService } = require('../services');
const ApiError = require('../utils/ApiError');
const sendResponse = require('../utils/sendResponse');

const createRoom = catchAsync(async (req, res) => {
  // Check if user is owner/manager of the PG
  await PgService.getPGById(req.body.pgId, req.user.id);
  
  const room = await roomService.createRoom(req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Room and beds created successfully',
    data: room
  });
});

const getRooms = catchAsync(async (req, res) => {
  const { pgId } = req.params;
  // Check access
  await PgService.getPGById(pgId, req.user.id);
  
  const rooms = await roomService.getRoomsByPg(pgId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Rooms fetched successfully',
    data: rooms
  });
});

const assignTenant = catchAsync(async (req, res) => {
  const { bedId } = req.params;
  const { userId, joiningDate } = req.body;
  
  const bed = await roomService.assignTenant(bedId, userId, joiningDate);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Tenant assigned to bed successfully',
    data: bed
  });
});

const unassignTenant = catchAsync(async (req, res) => {
  const { bedId } = req.params;
  
  const bed = await roomService.unassignTenant(bedId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Tenant removed from bed successfully',
    data: bed
  });
});

const updateBed = catchAsync(async (req, res) => {
  const { bedId } = req.params;
  
  const bed = await roomService.updateBed(bedId, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Bed updated successfully',
    data: bed
  });
});

const updateRoom = catchAsync(async (req, res) => {
  const { roomId } = req.params;
  const room = await roomService.updateRoom(roomId, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Room updated successfully',
    data: room
  });
});

const deleteRoom = catchAsync(async (req, res) => {
  const { roomId } = req.params;
  await roomService.deleteRoom(roomId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Room deleted successfully'
  });
});

const getEligibleTenants = catchAsync(async (req, res) => {
  const { pgId } = req.params;
  const users = await roomService.getEligibleTenants(pgId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Eligible tenants fetched successfully',
    data: users
  });
});

module.exports = {
  createRoom,
  getRooms,
  assignTenant,
  unassignTenant,
  updateRoom,
  deleteRoom,
  getEligibleTenants,
  updateBed
};
