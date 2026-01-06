const { ownerController } = require("../controllers");
const auth = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const { ownerValidation } = require("../validations");

const router = require("express").Router();

// All owner routes require authentication
router.use(auth());

router.post(
  "/pg",
  validate(ownerValidation.createPG),
  ownerController.createPG
);

router.get("/pgs", validate(ownerValidation.listPGs), ownerController.getPGs);

router.get(
  "/pg/:pgId",
  validate(ownerValidation.getPG),
  ownerController.getPG
);

router.patch(
  "/pg/:pgId",
  validate(ownerValidation.updatePG),
  ownerController.updatePG
);

router.delete(
  "/pg/:pgId",
  validate(ownerValidation.deletePG),
  ownerController.deletePG
);

module.exports = router;
