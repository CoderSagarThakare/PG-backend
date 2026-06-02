const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const sendResponse = require("../utils/sendResponse");
const employeeService = require("../services/employee.service");
const { PG, User } = require("../models");

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
  const employee = await employeeService.addEmployee(req.body, req.user._id);
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
  sendResponse(res, { data: result, statusCode: httpStatus.OK });
});

const updateEmployee = catchAsync(async (req, res) => {
  const employee = await employeeService.updateEmployee(req.params.id, req.body);
  sendResponse(res, { data: employee, message: "Staff record updated" });
});

const removeEmployee = catchAsync(async (req, res) => {
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
  const users = await User.find(filter, "name email role picture mobNo1")
    .limit(Number(limit))
    .sort({ name: 1 });
  sendResponse(res, { data: { users }, statusCode: httpStatus.OK });
});

module.exports = { addEmployee, getEmployees, updateEmployee, removeEmployee, searchStaffUsers };

