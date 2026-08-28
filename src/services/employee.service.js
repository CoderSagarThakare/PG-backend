const mongoose = require("mongoose");
const { Employee } = require("../models");
const { User, PG } = require("../models");
const ApiError = require("../utils/ApiError");
const httpStatus = require("http-status");

/**
 * Clean employee record by filtering out null or deleted PGs,
 * updating the pgSalaries map accordingly, and recalculating total salary.
 */
const cleanEmployeeRecord = (emp) => {
  if (!emp) return emp;

  // Filter out null / deleted pgIds
  const activePgIds = (emp.pgIds || []).filter(Boolean);

  // Create a clean pgSalaries object containing only active PG IDs
  const activePgIdStrings = activePgIds.map(pg => String(pg._id || pg));
  const cleanedPgSalaries = {};
  if (emp.pgSalaries) {
    const salariesObj = emp.pgSalaries instanceof Map ? Object.fromEntries(emp.pgSalaries) : emp.pgSalaries;
    for (const pgIdStr of activePgIdStrings) {
      if (salariesObj[pgIdStr] !== undefined) {
        cleanedPgSalaries[pgIdStr] = salariesObj[pgIdStr];
      }
    }
  }

  // Recalculate total salary based on active PGs to prevent revenue leakage
  const activeTotalSalary = Object.values(cleanedPgSalaries).reduce((sum, val) => sum + (Number(val) || 0), 0);

  return {
    ...emp,
    pgIds: activePgIds,
    pgSalaries: cleanedPgSalaries,
    monthlySalary: activeTotalSalary > 0 ? activeTotalSalary : emp.monthlySalary
  };
};

/**
 * Add a staff member (employee/manager) to a PG.
 * The role is derived from the existing User account — no role override allowed.
 */
/**
 * Bidirectional manager-to-PG sync.
 * Ensures the managerId field on the PG document is kept in sync with the Employee's pgIds list.
 */
const syncManagerWithPgs = async (managerUserId, oldPgIds = [], newPgIds = []) => {
  const oldPgIdStrings = oldPgIds.map(String);
  const newPgIdStrings = newPgIds.map(String);

  const addedPgs = newPgIdStrings.filter(id => !oldPgIdStrings.includes(id));
  const removedPgs = oldPgIdStrings.filter(id => !newPgIdStrings.includes(id));

  // Process added PGs
  for (const pgId of addedPgs) {
    const pg = await PG.findOne({ _id: pgId, isDeleted: false });
    if (pg) {
      const oldManagerUserId = pg.managerId;
      if (oldManagerUserId && String(oldManagerUserId) !== String(managerUserId)) {
        // Remove PG from the old manager's pgIds list
        const oldManagerEmp = await Employee.findOne({ userId: oldManagerUserId, isDeleted: false });
        if (oldManagerEmp) {
          oldManagerEmp.pgIds = oldManagerEmp.pgIds.filter(id => String(id) !== String(pgId));
          if (oldManagerEmp.pgIds.length === 0) {
            oldManagerEmp.status = "inactive";
          }
          await oldManagerEmp.save();
        }
      }
      // Set this manager as PG manager
      pg.managerId = managerUserId;
      await pg.save();
    }
  }

  // Process removed PGs
  for (const pgId of removedPgs) {
    await PG.updateOne(
      { _id: pgId, managerId: managerUserId, isDeleted: false },
      { $set: { managerId: null } }
    );
  }
};

/**
 * Add a staff member (employee/manager) to a PG.
 * The role is derived from the existing User account — no role override allowed.
 */
const addEmployee = async (data, addedBy) => {
  const { userId, pgId, pgIds, joinedDate, monthlySalary, notes, pgSalaries, designation } = data;

  // Validate user exists and has an allowed role
  const user = await User.findOne({ _id: userId, isDeleted: false });
  if (!user) throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  if (!["employee", "manager"].includes(user.role)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Only users with 'employee' or 'manager' role can be added as staff");
  }

  // Resolve array of pgIds
  const resolvedPgIds = pgIds || (pgId ? [pgId] : []);
  if (resolvedPgIds.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "At least one PG assignment is required");
  }

  // Validate PGs exist
  const pgCount = await PG.countDocuments({ _id: { $in: resolvedPgIds }, isDeleted: false });
  if (pgCount !== resolvedPgIds.length) {
    throw new ApiError(httpStatus.NOT_FOUND, "One or more PGs not found");
  }

  // Check if Employee record already exists for this user
  let employee = await Employee.findOne({ userId, isDeleted: false });
  const oldPgIds = employee ? [...employee.pgIds] : [];

  if (employee) {
    // Merge assignments
    const mergedPgIds = Array.from(
      new Set([...employee.pgIds.map(String), ...resolvedPgIds.map(String)])
    ).map(id => new mongoose.Types.ObjectId(id));
    
    employee.pgIds = mergedPgIds;
    employee.status = "active";
    if (monthlySalary !== undefined) employee.monthlySalary = monthlySalary;
    if (joinedDate) employee.joinedDate = joinedDate;
    if (notes) employee.notes = notes;
    if (pgSalaries !== undefined) employee.pgSalaries = pgSalaries;
    if (designation !== undefined) employee.designation = designation;
    await employee.save();
  } else {
    // Create new profile record
    employee = await Employee.create({
      userId,
      pgIds: resolvedPgIds,
      joinedDate,
      monthlySalary,
      pgSalaries: pgSalaries || {},
      designation: designation || (user.role === "manager" ? "manager" : "other"),
      notes: notes || null,
      addedBy,
    });
  }

  // Sync PGs if role is manager
  if (user.role === "manager") {
    await syncManagerWithPgs(userId, oldPgIds, employee.pgIds);
  }

  const populated = await employee.populate([
    { path: "userId", select: "name email mobNo1 role picture profileImageKey" },
    { path: "pgIds", select: "name", match: { isDeleted: false } },
  ]);
  return cleanEmployeeRecord(populated.toObject());
};

/**
 * Get all staff for PGs owned/managed by this user.
 */
const getEmployees = async ({ pgId, userId, status, page = 1, limit = 20 }) => {
  const filter = { isDeleted: false };
  if (pgId) filter.pgIds = pgId;
  if (userId) filter.userId = userId;
  if (status) filter.status = status;

  const skip = (page - 1) * limit;
  const [employees, total] = await Promise.all([
    Employee.find(filter)
      .populate({ path: "userId", select: "name email mobNo1 role picture gender profileImageKey" })
      .populate({ path: "pgIds", select: "name", match: { isDeleted: false } })
      .populate({ path: "addedBy", select: "name" })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Employee.countDocuments(filter),
  ]);

  const cleanedEmployees = employees.map(emp => cleanEmployeeRecord(emp.toObject()));

  return { employees: cleanedEmployees, total, page: Number(page), limit: Number(limit) };
};

/**
 * Update a staff member's salary, status, or notes.
 */
const updateEmployee = async (employeeId, updates) => {
  const employee = await Employee.findOne({ _id: employeeId, isDeleted: false });
  if (!employee) throw new ApiError(httpStatus.NOT_FOUND, "Staff record not found");

  const user = await User.findById(employee.userId);
  const isManager = user && user.role === "manager";
  const oldPgIds = [...employee.pgIds];

  // If updates.pgIds is provided, prevent unassigning the manager if they are the current active manager of the PG
  if (isManager && updates.pgIds !== undefined) {
    const newPgIdStrings = updates.pgIds.map(String);
    const oldPgIdStrings = oldPgIds.map(String);
    const removedPgIds = oldPgIdStrings.filter(id => !newPgIdStrings.includes(id));

    for (const pgId of removedPgIds) {
      const pg = await PG.findOne({ _id: pgId, isDeleted: false });
      if (pg && pg.managerId && String(pg.managerId) === String(employee.userId)) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `'${pg.name}' needs a manager. Assign another manager first.`
        );
      }
    }
  }

  // Prevent deactivation if manager is still active manager for any PGs
  if (isManager && updates.status === "inactive") {
    const assignedPgs = await PG.find({ managerId: employee.userId, isDeleted: false });
    if (assignedPgs.length > 0) {
      const pgNames = assignedPgs.map(pg => `'${pg.name}'`).join(", ");
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Cannot deactivate manager: ${pgNames} need a manager first.`
      );
    }
  }

  const allowed = ["monthlySalary", "status", "notes", "joinedDate", "pgIds", "pgSalaries", "designation"];
  allowed.forEach((key) => {
    if (updates[key] !== undefined) employee[key] = updates[key];
  });

  await employee.save();

  // Sync PGs if role is manager and pgIds were modified
  if (isManager && updates.pgIds !== undefined) {
    await syncManagerWithPgs(employee.userId, oldPgIds, employee.pgIds);
  }

  const populated = await employee.populate([
    { path: "userId", select: "name email mobNo1 role picture profileImageKey" },
    { path: "pgIds", select: "name", match: { isDeleted: false } },
  ]);
  return cleanEmployeeRecord(populated.toObject());
};

/**
 * Soft-delete (remove) a staff record.
 */
const removeEmployee = async (employeeId) => {
  const employee = await Employee.findOne({ _id: employeeId, isDeleted: false });
  if (!employee) throw new ApiError(httpStatus.NOT_FOUND, "Staff record not found");

  const user = await User.findById(employee.userId);
  const isManager = user && user.role === "manager";

  if (isManager) {
    const assignedPgs = await PG.find({ managerId: employee.userId, isDeleted: false });
    if (assignedPgs.length > 0) {
      const pgNames = assignedPgs.map(pg => `'${pg.name}'`).join(", ");
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Cannot remove manager: ${pgNames} need a manager first.`
      );
    }
  }

  employee.isDeleted = true;
  await employee.save();
};

module.exports = { addEmployee, getEmployees, updateEmployee, removeEmployee };
