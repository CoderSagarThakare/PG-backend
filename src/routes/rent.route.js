const router = require("express").Router();
const auth = require("../middlewares/auth");
const { ROLE_TYPES } = require("../const/constant");
const rentController = require("../controllers/rent.controller");

// Only owner and manager can manage rent
const staffAuth = auth(ROLE_TYPES.owner, ROLE_TYPES.manager);
const userAuth = auth(ROLE_TYPES.user);

router.get("/summary", staffAuth, rentController.getMonthlySummary);        // GET /rent/summary?pgId=&rentMonth=
router.get("/", staffAuth, rentController.getRentPayments);                  // GET /rent?pgId=&rentMonth=&status=
router.post("/", staffAuth, rentController.recordPayment);                   // POST /rent
router.post("/generate", staffAuth, rentController.generateMonthlyRent);     // POST /rent/generate  (bulk)
router.post("/bulk-approve", staffAuth, rentController.bulkApprovePayments); // POST /rent/bulk-approve

router.get("/my-rent", userAuth, rentController.getMyRentPayments);            // GET /rent/my-rent (Student)
router.post("/:id/submit-proof", userAuth, rentController.submitPaymentProof); // POST /rent/:id/submit-proof (Student)

router.post("/:id/approve", staffAuth, rentController.approvePayment);       // POST /rent/:id/approve
router.post("/:id/reject", staffAuth, rentController.rejectPayment);         // POST /rent/:id/reject

router.patch("/:id", staffAuth, rentController.updatePayment);               // PATCH /rent/:id?pgId=
router.delete("/:id", staffAuth, rentController.deletePayment);              // DELETE /rent/:id?pgId=

module.exports = router;

