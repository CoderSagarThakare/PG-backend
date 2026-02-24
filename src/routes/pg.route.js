const { pgController, facilitiesController } = require("../controllers");
const validate = require("../middlewares/validate");
const { pgValidation } = require("../validations");

const router = require("express").Router();

// Create a new PG
router.post("/", validate(pgValidation.createPG), pgController.createPG);

// Get all PGs
router.get("/", validate(pgValidation.listPGs), pgController.getPGs);

// Get all facilities
router.get("/facilities", facilitiesController.getAllFacilities);

// Get a specific PG
router.get("/:pgId", validate(pgValidation.getPG), pgController.getPG);

// Update a PG
router.patch("/:pgId", validate(pgValidation.updatePG), pgController.updatePG);

// Delete a PG
router.delete("/:pgId", validate(pgValidation.deletePG), pgController.deletePG);

module.exports = router;
