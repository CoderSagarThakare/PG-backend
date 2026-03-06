const { ownerController } = require("../controllers");
const validate = require("../middlewares/validate");
const { pgValidation } = require("../validations");
const ownerRoute = require("./owner.route");
const managerRoute = require("./manager.route");
const employeeRoute = require("./employee.route");
const auth = require("../middlewares/auth");
const { ROLE_TYPES } = require("../const/constant");

const router = require("express").Router();
// Role-based subrouters mounted under /pg
router.use("/owner", auth(ROLE_TYPES.owner), ownerRoute);
router.use("/manager", auth(ROLE_TYPES.manager), managerRoute);
router.use("/employee", auth(ROLE_TYPES.employee), employeeRoute);

// create new PG
router.post(
  "/",
  auth(ROLE_TYPES.owner),
  validate(pgValidation.createPG),
  ownerController.createPG,
);

router.get("/", validate(pgValidation.listPGs), ownerController.getPGs);

module.exports = router;
