const { ROLE_TYPES } = require("../const/constant");
const { userPreferenceController } = require("../controllers");
const auth = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const { userPreferenceValidation } = require("../validations");

const router = require("express").Router();

// All routes protected, only user
router.use(auth(ROLE_TYPES.user));

router
  .route("/")
  .post(
    validate(userPreferenceValidation.createPreference),
    userPreferenceController.createPreference,
  );

router
  .route("/:preferenceId")
  .get(
    validate(userPreferenceValidation.getPreference),
    userPreferenceController.getPreference,
  )
  .patch(
    validate(userPreferenceValidation.updatePreference),
    userPreferenceController.updatePreference,
  )
  .delete(
    validate(userPreferenceValidation.deletePreference),
    userPreferenceController.deletePreference,
  );

module.exports = router;
