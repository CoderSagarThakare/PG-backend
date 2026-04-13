const { ROLE_TYPES } = require("../const/constant");
const { enquiryController } = require("../controllers");
const auth = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const { enquiryValidation } = require("../validations");

const router = require("express").Router();

// User routes
router.post(
  "/",
  validate(enquiryValidation.createEnquiry),
  enquiryController.createEnquiry,
);
// ---------------------------------
// Staff routes (owner/manager)
// router.use(auth(ROLE_TYPES.manager, ROLE_TYPES.owner));

router.get("/", enquiryController.getEnquiries);
router.get(
  "/:enquiryId",
  validate(enquiryValidation.getEnquiry),
  enquiryController.getEnquiry,
);
// router.patch(
//   "/:enquiryId",
//   validate(enquiryValidation.updateEnquiry),
//   enquiryController.updateEnquiry,
// );
// router.delete(
//   "/:enquiryId",
//   validate(enquiryValidation.deleteEnquiry),
//   enquiryController.deleteEnquiry,
// );

module.exports = router;
