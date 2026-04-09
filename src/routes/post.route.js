const { ROLE_TYPES } = require('../const/constant');
const { postController } = require('../controllers');
const auth = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { postValidation } = require('../validations');

const router = require('express').Router();

// public/user recommendation route (requires user auth)
router.get('/search', auth(ROLE_TYPES.user), postController.getPostsByPreference);

// owner endpoints
// router.use(auth(ROLE_TYPES.owner));
router.post(
  '/',
  validate(postValidation.createPost),
  postController.createPost,
);
router.get('/:postId', validate(postValidation.getPost), postController.getPost);
router.get('/', postController.getPosts);   // update for manager and owner diffrently : not working

router.patch(
  '/:postId',
  validate(postValidation.updatePost),
  postController.updatePost,
);
router.delete(
  '/:postId',
  validate(postValidation.deletePost),
  postController.deletePost,
);

module.exports = router;
