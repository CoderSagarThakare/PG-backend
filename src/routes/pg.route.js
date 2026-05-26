const {
  pgController,
  facilitiesController,
} = require("../controllers");
const validate = require("../middlewares/validate");
const { pgValidation } = require("../validations");
const ownerRoute = require("./owner.route");
const managerRoute = require("./manager.route");
const employeeRoute = require("./employee.route");
const auth = require("../middlewares/auth");
const { ROLE_TYPES } = require("../const/constant");

const router = require("express").Router();

// Publicly accessible facilities (also for users to filter)
router.get("/facilities", auth(ROLE_TYPES.owner, ROLE_TYPES.manager, ROLE_TYPES.user), facilitiesController.getAllFacilities);

// Publicly accessible PG discovery
router.get("/discover", auth(ROLE_TYPES.owner, ROLE_TYPES.manager, ROLE_TYPES.user), pgController.discoverPGs);

// Presigned upload url route for PG images
router.get("/upload-url", auth(ROLE_TYPES.owner, ROLE_TYPES.manager), pgController.getPGImageUploadUrl);

// Delete uploaded PG image route
router.delete("/file", auth(ROLE_TYPES.owner, ROLE_TYPES.manager), pgController.deletePGImageFile);

// Publicly accessible individual PG details
router.get("/:pgId", auth(ROLE_TYPES.owner, ROLE_TYPES.manager, ROLE_TYPES.user), pgController.getPG);

// Apply auth middleware to all other PG management routes (owner and manager allowed)
router.use(auth(ROLE_TYPES.owner, ROLE_TYPES.manager));

// Role-based subrouters mounted under /pg
// router.use("/owner", auth(ROLE_TYPES.owner), ownerRoute);
// router.use("/manager", auth(ROLE_TYPES.manager), managerRoute);
// router.use("/employee", auth(ROLE_TYPES.employee), employeeRoute);

// register new PG (Owner only)
router.post("/", auth(ROLE_TYPES.owner), validate(pgValidation.createPG), pgController.createPG);


// Get price range for beds in a PG
router.get("/:pgId/price-range", validate(pgValidation.getPG), pgController.getPriceRange);

// Get PG Details
router.get("/:pgId", validate(pgValidation.getPG), pgController.getPG);

// Get all PGs of owner
router.get("/", validate(pgValidation.listPGs), pgController.getPGs);

// update PG details
router.patch("/:pgId", validate(pgValidation.updatePG), pgController.updatePG);

router.delete("/:pgId", validate(pgValidation.deletePG), pgController.deletePG);


module.exports = router;
