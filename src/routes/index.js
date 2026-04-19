const express = require("express");
const router = express.Router();

const authRoute = require("./auth.route");
const userRoute = require("./user.route");
const staffRoute = require("./staff.route");
const ownerRoute = require("./owner.route");
const managerRoute = require("./manager.route");
const employeeRoute = require("./employee.route");
const enquiryRoutes = require("./enquiry.route");

const defaultRoutes = [
  { path: "/auth", route: authRoute }, // base path for auth routes
  { path: "/user", route: userRoute }, // base path for user routes
  { path: "/owner", route: ownerRoute }, // base path for owner routes
  { path: "/manager", route: managerRoute },
  { path: "/staff", route: staffRoute }, // base path for staff routes
  { path: "/enquiries", route: enquiryRoutes } // base path for enquiry routes
];

defaultRoutes.map((route) => {
  router.use(route.path, route.route);
});

module.exports = router;
