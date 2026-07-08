const { ROLE_TYPES } = require("../const/constant");
const { postController } = require("../controllers");
const auth = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const { postValidation } = require("../validations");

const router = require("express").Router();

// public/user recommendation route (requires auth for all roles)
router.get(
  "/search",
  auth(ROLE_TYPES.owner, ROLE_TYPES.manager, ROLE_TYPES.user, ROLE_TYPES.employee),
  postController.getPostsByPreference,
);

// owner endpoints
// router.use(auth(ROLE_TYPES.owner));
router.get(
  "/upload-url",
  auth(ROLE_TYPES.owner, ROLE_TYPES.manager),
  postController.getPostImageUploadUrl
);
router.delete(
  "/file",
  auth(ROLE_TYPES.owner, ROLE_TYPES.manager),
  postController.deletePostImageFile
);
router.post(
  "/",
  auth(ROLE_TYPES.owner, ROLE_TYPES.manager),
  validate(postValidation.createPost),
  postController.createPost,
);
router.get(
  "/:postId",
  auth(ROLE_TYPES.owner, ROLE_TYPES.manager),
  validate(postValidation.getPost),
  postController.getPost,
);
router.get(
  "/",
  auth(ROLE_TYPES.owner, ROLE_TYPES.manager),
  postController.getPosts,
); // update for manager and owner diffrently : not working

router.patch(
  "/:postId",
  auth(ROLE_TYPES.owner, ROLE_TYPES.manager),
  validate(postValidation.updatePost),
  postController.updatePost,
);
router.delete(
  "/:postId",
  auth(ROLE_TYPES.owner, ROLE_TYPES.manager),
  validate(postValidation.deletePost),
  postController.deletePost,
);

module.exports = router;
