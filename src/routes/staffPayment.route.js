const router = require("express").Router();
const auth = require("../middlewares/auth");
const { ROLE_TYPES } = require("../const/constant");
const staffPaymentController = require("../controllers/staffPayment.controller");

const staffAuth = auth(ROLE_TYPES.owner, ROLE_TYPES.manager);

// GET  /staff-payments            — list payroll records
// POST /staff-payments/generate   — generate a monthly payroll record for an employee
router.get("/", staffAuth, staffPaymentController.getPayrolls);
router.post("/generate", staffAuth, staffPaymentController.generatePayroll);

// PATCH /staff-payments/:id/pay   — mark payroll as paid with transaction details
router.patch("/:id/pay", staffAuth, staffPaymentController.markPayrollPaid);

module.exports = router;
