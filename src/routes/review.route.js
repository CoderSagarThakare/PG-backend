const { ROLE_TYPES } = require("../const/constant");
const { reviewController } = require("../controllers");
const auth = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const { reviewValidation } = require("../validations");

const router = require("express").Router();

// Create or update a review (Tenants only)
router.post(
  "/",
  auth(ROLE_TYPES.user),
  validate(reviewValidation.createOrUpdateReview),
  reviewController.createOrUpdateReview
);

// Get all reviews for a PG (Public - all roles: guests, tenants, owners, managers)
router.get(
  "/pg/:pgId",
  validate(reviewValidation.getPGReviews),
  reviewController.getPGReviews
);

// Get logged in user's review for a PG (Tenants only)
router.get(
  "/my-review/:pgId",
  auth(ROLE_TYPES.user),
  validate(reviewValidation.getMyReview),
  reviewController.getMyReview
);

// Delete a review (Owner of the review only)
router.delete(
  "/:reviewId",
  auth(ROLE_TYPES.user),
  validate(reviewValidation.deleteReview),
  reviewController.deleteReview
);

module.exports = router;
