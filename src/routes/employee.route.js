const validate = require("../middlewares/validate");
const { pgValidation } = require("../validations");
const { employeeController } = require("../controllers");

const router = require("express").Router();

// router.post("/", validate(pgValidation.createPG), employeeController.createPG);
// router.get("/", validate(pgValidation.listPGs), employeeController.getPGs);
// router.get("/:pgId", validate(pgValidation.getPG), employeeController.getPG);
// router.patch("/:pgId", validate(pgValidation.updatePG), employeeController.updatePG);
// router.delete("/:pgId", validate(pgValidation.deletePG), employeeController.deletePG);

module.exports = router;
