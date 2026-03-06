const express = require("express");
const router = express.Router();
const validate = require("../middlewares/validate");
const { pgValidation, postValidation } = require("../validations");
const { ownerController, pgController, facilitiesController, postController } = require("../controllers");
const { ROLE_TYPES } = require("../const/constant");
const auth = require("../middlewares/auth");

// All owner routes require authentication
// router.use(auth(ROLE_TYPES.owner));

// PG-related routes for owners (mounted under /pg/owner)
router.get("/:pgId", validate(pgValidation.getPG), ownerController.getPG);
router.patch("/:pgId", validate(pgValidation.updatePG), ownerController.updatePG);
router.delete("/:pgId", validate(pgValidation.deletePG), ownerController.deletePG);
router.get("/facilities", facilitiesController.getAllFacilities);
 
// Post-related routes for owners
router.post(
  "/post",
  validate(postValidation.createPost),
  postController.createPost,
);

router.get(
  "/posts",
  validate(postValidation.listPosts),
  postController.getPosts,
);

router.get(
  "/post/:postId",
  validate(postValidation.getPost),
  postController.getPost,
);

router.patch(
  "/post/:postId",
  validate(postValidation.updatePost),
  postController.updatePost,
);

router.delete(
  "/post/:postId",
  validate(postValidation.deletePost),
  postController.deletePost,
);

module.exports = router;
