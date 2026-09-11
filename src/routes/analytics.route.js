const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const { ROLE_TYPES } = require("../const/constant");
const analyticsController = require("../controllers/analytics.controller");
const analyticsValidation = require("../validations/analytics.validation");

router.get(
  "/overview",
  auth(ROLE_TYPES.owner, ROLE_TYPES.manager),
  validate(analyticsValidation.getOverview),
  analyticsController.getOverview
);

module.exports = router;
