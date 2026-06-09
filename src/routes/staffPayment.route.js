const router = require("express").Router();
const auth = require("../middlewares/auth");
const { ROLE_TYPES } = require("../const/constant");
const staffPaymentController = require("../controllers/staffPayment.controller");

const staffAuth = auth(ROLE_TYPES.owner, ROLE_TYPES.manager);
const anyStaffAuth = auth(ROLE_TYPES.owner, ROLE_TYPES.manager, ROLE_TYPES.employee);

// GET  /staff-payments            — list payroll records (accessible by employees, managers, and owners)
router.get("/", anyStaffAuth, staffPaymentController.getPayrolls);
router.post("/generate", staffAuth, staffPaymentController.generatePayroll);

// PATCH /staff-payments/:id/pay   — mark payroll as paid with transaction details
router.patch("/:id/pay", staffAuth, staffPaymentController.markPayrollPaid);

// PATCH /staff-payments/:id       — update payroll record details (salary amount, reimbursed expenses)
router.patch("/:id", staffAuth, staffPaymentController.updatePayroll);

module.exports = router;
