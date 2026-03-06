// const { ROLE_TYPES } = require("../const/constant");
// const { pgController, facilitiesController, postController, staffController } = require("../controllers");
// const auth = require("../middlewares/auth");
// const validate = require("../middlewares/validate");
// const { pgValidation, postValidation } = require("../validations");
// const pgRoute = require("./pg.route");

// const router = require("express").Router();

// // All staff routes require authentication and must be a staff member (ownermanager, employee, or admin)
// router.use(auth(ROLE_TYPES.owner, ROLE_TYPES.manager, ROLE_TYPES.employee, ROLE_TYPES.admin));

// // Staff profile routes
// router.get("/profile", staffController.getStaff);
// router.patch("/profile", staffController.updateStaff);

// // Staff management routes (Admin/Manager only)
// router.get("/all", auth(ROLE_TYPES.admin), staffController.getAllStaff);
// router.get("/by-role/:role", auth(ROLE_TYPES.admin), staffController.getStaffByRole);

// // PG related routes (Only for owners and managers)
// router.use("/pg", auth(ROLE_TYPES.owner, ROLE_TYPES.manager), pgRoute);

// // Post related routes (Only for owners and managers)
// router.post(
//   "/post",
//   auth(ROLE_TYPES.owner, ROLE_TYPES.manager),
//   validate(postValidation.createPost),
//   postController.createPost,
// );

// router.get(
//   "/posts",
//   auth(ROLE_TYPES.owner, ROLE_TYPES.manager),
//   validate(postValidation.listPosts),
//   postController.getPosts,
// );

// router.get(
//   "/post/:postId",
//   auth(ROLE_TYPES.owner, ROLE_TYPES.manager),
//   validate(postValidation.getPost),
//   postController.getPost,
// );

// router.patch(
//   "/post/:postId",
//   auth(ROLE_TYPES.owner, ROLE_TYPES.manager),
//   validate(postValidation.updatePost),
//   postController.updatePost,
// );

// router.delete(
//   "/post/:postId",
//   auth(ROLE_TYPES.owner, ROLE_TYPES.manager),
//   validate(postValidation.deletePost),
//   postController.deletePost,
// );

// module.exports = router;
