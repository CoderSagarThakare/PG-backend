const { pgController } = require("../controllers");
const auth = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const { ownerValidation } = require("../validations");

const router = require("express").Router();

// All owner routes require authentication
router.use(auth());

// register new PG
router.post(
  "/pg",
  validate(ownerValidation.createPG),
  pgController.createPG
);

router.get("/pgs", validate(ownerValidation.listPGs), pgController.getPGs);

router.get(
  "/pg/:pgId",
  validate(ownerValidation.getPG),
  pgController.getPG
);

router.patch(
  "/pg/:pgId",
  validate(ownerValidation.updatePG),
  pgController.updatePG
);

router.delete(
  "/pg/:pgId",
  validate(ownerValidation.deletePG),
  pgController.deletePG
);

module.exports = router;
