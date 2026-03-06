const express = require("express");
const router = express.Router();

const authRoute = require("./auth.route");
const userRoute = require("./user.route");
const staffRoute = require("./staff.route");
const pgRoute = require("./pg.route");

const defaultRoutes = [
  { path: "/auth", route: authRoute }, // base path for auth routes
  { path: "/user", route: userRoute }, // base path for user routes
  { path: "/pg", route: pgRoute }, // base path for PG routes (with role subrouters)
];

defaultRoutes.map((route) => {
  router.use(route.path, route.route);
});

module.exports = router;
