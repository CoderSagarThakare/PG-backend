const { pgController, facilitiesController } = require("../controllers");
const auth = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const { pgValidation } = require("../validations");

const router = require("express").Router();

// All owner routes require authentication
router.use(auth());

// register new PG
router.post("/pg", validate(pgValidation.createPG), pgController.createPG);

router.get("/pgs", validate(pgValidation.listPGs), pgController.getPGs);

router.get("/pg/:pgId", validate(pgValidation.getPG), pgController.getPG);

router.patch(
  "/pg/:pgId",
  validate(pgValidation.updatePG),
  pgController.updatePG,
);

router.delete(
  "/pg/:pgId",
  validate(pgValidation.deletePG),
  pgController.deletePG,
);

router.get("/facilities", facilitiesController.getAllFacilities);

module.exports = router;
