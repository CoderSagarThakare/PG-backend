const validate = require("../middlewares/validate");
const { pgValidation } = require("../validations");
const { managerController } = require("../controllers");

const router = require("express").Router();

// router.post("/", validate(pgValidation.createPG), managerController.createPG);
// router.get("/", validate(pgValidation.listPGs), managerController.getPGs);
// router.get("/:pgId", validate(pgValidation.getPG), managerController.getPG);
// router.patch("/:pgId", validate(pgValidation.updatePG), managerController.updatePG);
// router.delete("/:pgId", validate(pgValidation.deletePG), managerController.deletePG);

module.exports = router;
