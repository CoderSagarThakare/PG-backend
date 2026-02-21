const { pgController, facilitiesController,postController } = require("../controllers");
const auth = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const { pgValidation, postValidation } = require("../validations");

const router = require("express").Router();

// All owner routes require authentication
router.use(auth());

// --------------------------- PG RELETED ROUTES
// register new PG
router.post("/pg", validate(pgValidation.createPG), pgController.createPG);

router.get("/pgs", validate(pgValidation.listPGs), pgController.getPGs);

router.get("/pg/:pgId", validate(pgValidation.getPG), pgController.getPG);

router.patch(
  "/pg/:pgId",
  validate(pgValidation.updatePG),
  pgController.updatePG,
);

router.delete(
  "/pg/:pgId",
  validate(pgValidation.deletePG),
  pgController.deletePG,
);

router.get("/facilities", facilitiesController.getAllFacilities);

// --------------------------- POST RELETED ROUTES

// Create a new vacancy post
router.post(
  "/post",
  validate(postValidation.createPost),
  postController.createPost,
);

// Get all posts created by the logged-in owner
router.get(
  "/posts",
  validate(postValidation.listPosts),
  postController.getPosts,
);

// Get a specific post detail
router.get(
  "/post/:postId",
  validate(postValidation.getPost),
  postController.getPost,
);

// Update post (e.g., mark as filled/inactive)
router.patch(
  "/post/:postId",
  validate(postValidation.updatePost),
  postController.updatePost,
);

// Delete a post
router.delete(
  "/post/:postId",
  validate(postValidation.deletePost),
  postController.deletePost,
);

module.exports = router;
