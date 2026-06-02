const router = require("express").Router();
const auth = require("../middlewares/auth");
const { ROLE_TYPES } = require("../const/constant");
const employeeController = require("../controllers/employee.controller");

const staffAuth = auth(ROLE_TYPES.owner, ROLE_TYPES.manager);

// GET /employees/search-users?search=&limit=  — search users by employee/manager role
router.get("/search-users", staffAuth, employeeController.searchStaffUsers);

// GET  /employees          — list all staff for owner's PGs
// POST /employees          — add a new staff member
router.get("/", auth(ROLE_TYPES.owner, ROLE_TYPES.manager, ROLE_TYPES.employee), employeeController.getEmployees);
router.post("/", staffAuth, employeeController.addEmployee);

// PATCH  /employees/:id    — update salary/status/notes
// DELETE /employees/:id    — soft-delete (remove from staff)
router.patch("/:id", staffAuth, employeeController.updateEmployee);
router.delete("/:id", staffAuth, employeeController.removeEmployee);

module.exports = router;

