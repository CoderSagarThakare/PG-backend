const validate = require("../middlewares/validate");
const { pgValidation } = require("../validations");
const { managerController } = require("../controllers");
const postRoutes = require("./post.route");
const auth = require("../middlewares/auth");
const { ROLE_TYPES } = require("../const/constant");

const router = require("express").Router();

// router.post("/", validate(pgValidation.createPG), managerController.createPG);
// router.get("/", validate(pgValidation.listPGs), managerController.getPGs);
// router.get("/:pgId", validate(pgValidation.getPG), managerController.getPG);
// router.patch("/:pgId", validate(pgValidation.updatePG), managerController.updatePG);
// router.delete("/:pgId", validate(pgValidation.deletePG), managerController.deletePG);

router.use(auth(ROLE_TYPES.manager));

module.exports = router;
