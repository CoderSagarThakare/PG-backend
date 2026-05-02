const express = require("express");
const router = express.Router();

const authRoute = require("./auth.route");
const userRoute = require("./user.route");
const staffRoute = require("./staff.route");
const ownerRoute = require("./owner.route");
const managerRoute = require("./manager.route");
const employeeRoute = require("./employee.route");
const enquiryRoutes = require("./enquiry.route");
const postRoute = require("./post.route");

const defaultRoutes = [
  { path: "/auth", route: authRoute }, // base path for auth routes
  { path: "/user", route: userRoute }, // base path for user routes
  { path: "/owner", route: ownerRoute }, // base path for owner routes
  { path: "/manager", route: managerRoute },
  { path: "/post", route: postRoute }, // base path for post routes
  { path: "/staff", route: staffRoute }, // base path for staff routes
  { path: "/enquiry", route: enquiryRoutes }, // base path for enquiry routes
  { path: "/pg", route: require("./pg.route") }, // base path for generic PG routes
  { path: "/room", route: require("./room.route") }, // base path for room routes
];

defaultRoutes.map((route) => {
  router.use(route.path, route.route);
});

module.exports = router;
