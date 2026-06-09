const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const sendResponse = require("../utils/sendResponse");
const employeeService = require("../services/employee.service");
const { PG, User, Employee } = require("../models");
const { awsService } = require("../services");

/**
 * Helper: Resolve profile picture signed S3 URL if profileImageKey exists.
 */
const resolveUserPicture = async (userIdObj) => {
  if (userIdObj && userIdObj.profileImageKey) {
    try {
      userIdObj.picture = await awsService.getFileUrl(userIdObj.profileImageKey);
    } catch (e) {
      // ignore or log
    }
  }
};

/**
 * Helper: Get PG IDs belonging to this owner/manager for access control.
 */
const getAccessiblePgIds = async (userId) => {
  const pgs = await PG.find({
    $or: [{ ownerId: userId }, { managerId: userId }],
    isDeleted: false,
  }, "_id");
  return pgs.map(p => String(p._id));
};

const addEmployee = catchAsync(async (req, res) => {
  // If the actor is a manager, check if the user being added has a manager role
  if (req.user.role === 'manager') {
    const targetUser = await User.findById(req.body.userId);
    if (targetUser && targetUser.role === 'manager') {
      return res.status(httpStatus.FORBIDDEN).json({
        message: "Managers are not permitted to register other managers as staff"
      });
    }
  }

  const employee = await employeeService.addEmployee(req.body, req.user._id);
  if (employee && employee.userId) {
    await resolveUserPicture(employee.userId);
  }
  sendResponse(res, { data: employee, statusCode: httpStatus.CREATED, message: "Staff member added successfully" });
});

const getEmployees = catchAsync(async (req, res) => {
  const query = { ...req.query };

  if (req.user.role === 'employee') {
    query.userId = String(req.user._id);
  } else {
    const pgIds = await getAccessiblePgIds(req.user._id);
    // If a specific pgId is requested, validate it belongs to this user
    if (query.pgId) {
      if (!pgIds.includes(String(query.pgId))) {
        return sendResponse(res, { data: { employees: [], total: 0, page: 1, limit: 20 }, statusCode: httpStatus.OK });
      }
    } else {
      // Limit to their PGs only
      query.pgId = { $in: pgIds };
    }
  }

  const result = await employeeService.getEmployees(query);
  if (result && Array.isArray(result.employees)) {
    for (const emp of result.employees) {
      if (emp.userId) {
        await resolveUserPicture(emp.userId);
      }
    }
  }
  sendResponse(res, { data: result, statusCode: httpStatus.OK });
});

const updateEmployee = catchAsync(async (req, res) => {
  if (req.user.role === 'manager') {
    const targetStaff = await Employee.findById(req.params.id).populate("userId");
    if (targetStaff && targetStaff.userId?.role === 'manager') {
      return res.status(httpStatus.FORBIDDEN).json({
        message: "Managers are not permitted to modify manager staff records"
      });
    }
  }

  const employee = await employeeService.updateEmployee(req.params.id, req.body);
  if (employee && employee.userId) {
    await resolveUserPicture(employee.userId);
  }
  sendResponse(res, { data: employee, message: "Staff record updated" });
});

const removeEmployee = catchAsync(async (req, res) => {
  if (req.user.role === 'manager') {
    const targetStaff = await Employee.findById(req.params.id).populate("userId");
    if (targetStaff && targetStaff.userId?.role === 'manager') {
      return res.status(httpStatus.FORBIDDEN).json({
        message: "Managers are not permitted to remove manager staff records"
      });
    }
  }

  await employeeService.removeEmployee(req.params.id);
  sendResponse(res, { message: "Staff member removed" });
});

/**
 * Search existing users with employee or manager role.
 * Used in the 'Add Staff' modal to find users to register as staff.
 */
const searchStaffUsers = catchAsync(async (req, res) => {
  const { search = "", limit = 10 } = req.query;
  const filter = {
    role: { $in: ["employee", "manager"] },
    isDeleted: false,
  };
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }
  const users = await User.find(filter, "name email role picture mobNo1 profileImageKey")
    .limit(Number(limit))
    .sort({ name: 1 });
  
  for (const u of users) {
    await resolveUserPicture(u);
  }

  sendResponse(res, { data: { users }, statusCode: httpStatus.OK });
});

module.exports = { addEmployee, getEmployees, updateEmployee, removeEmployee, searchStaffUsers };
