const { userController } = require("../controllers");
const auth = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const { userValidation } = require("../validations");

const router = require("express").Router();

// Token authentication for all routes defined in this file
router.use(auth());

// get update user
router
  .route("/self")
  .get(userController.getUser)
  .patch(validate(userValidation.updateUser), userController.updateUser);

module.exports = router;
