const router = require("express").Router();
const auth = require("../middlewares/auth");
const { ROLE_TYPES } = require("../const/constant");
const expenseController = require("../controllers/expense.controller");

// Any authenticated staff (employee/manager/owner) can submit expenses
const anyStaff = auth(ROLE_TYPES.owner, ROLE_TYPES.manager, ROLE_TYPES.employee);
// Only owner/manager can approve/reject
const staffAuth = auth(ROLE_TYPES.owner, ROLE_TYPES.manager);

// GET  /expenses            — list expenses (owner/manager sees PG-wide; employee sees own)
// POST /expenses            — submit a new expense claim
router.get("/", anyStaff, expenseController.getExpenses);
router.post("/", anyStaff, expenseController.createExpense);

// PATCH /expenses/:id/process   — approve or reject (owner/manager only)
router.patch("/:id/process", staffAuth, expenseController.processExpense);

// PATCH /expenses/:id/pay       — mark a direct reimbursement as paid
router.patch("/:id/pay", staffAuth, expenseController.markExpensePaid);

// DELETE /expenses/:id          — delete a pending expense
router.delete("/:id", anyStaff, expenseController.deleteExpense);

module.exports = router;
