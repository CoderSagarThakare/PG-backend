const express = require("express");
const router = express.Router();

const authRoute = require("./auth.route");
const userRoute = require("./user.route");
const ownerRoute = require("./owner.route");

const defaultRoutes = [
  { path: "/auth", route: authRoute }, // base path for auth routes
  { path: "/user", route: userRoute }, // base path for user routes
  { path: "/owner", route: ownerRoute }, // base path for owner routes
];

defaultRoutes.map((route) => {
  router.use(route.path, route.route);
});

module.exports = router;
