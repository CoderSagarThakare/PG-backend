const express = require("express");
const router = express.Router();

const authRoute = require("./auth.route");
const userRoute = require("./user.route");
const ownerRoute = require("./owner.route");
const managerRoute = require("./manager.route");
const enquiryRoutes = require("./enquiry.route");
const postRoute = require("./post.route");

const defaultRoutes = [
  { path: "/auth", route: authRoute }, // base path for auth routes
  { path: "/user", route: userRoute }, // base path for user routes
  { path: "/owner", route: ownerRoute }, // base path for owner routes
  { path: "/manager", route: managerRoute },
  { path: "/post", route: postRoute }, // base path for post routes
  { path: "/enquiry", route: enquiryRoutes }, // base path for enquiry routes
  { path: "/pg", route: require("./pg.route") }, // base path for generic PG routes
  { path: "/room", route: require("./room.route") }, // base path for room routes
  { path: "/rent", route: require("./rent.route") }, // base path for rent tracking
  { path: "/profile", route: require("./profile.route") }, // unified profile routes
  { path: "/cron", route: require("./cron.route") }, // base path for external cron triggers
  { path: "/staff", route: require("./staff.route") }, // base path for staff management
  { path: "/employees", route: require("./employee.route") }, // Staff member registry
  { path: "/expenses", route: require("./expense.route") }, // Expense claims
  { path: "/staff-payments", route: require("./staffPayment.route") }, // Monthly payroll
  { path: "/review", route: require("./review.route") },
  { path: "/onboarding", route: require("./onboarding.route") }, // Tenant onboarding lifecycle
];

defaultRoutes.map((route) => {
  router.use(route.path, route.route);
});

// General health check route for keeping the server warm (e.g. Render)
router.get("/health", (req, res) => {
  res.status(200).send("OK");
});

module.exports = router;
