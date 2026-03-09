const express = require("express");
const router = express.Router();
const { staffController } = require("../controllers");


// Staff profile routes
router.get("/", staffController.getStaff);
router.patch("/", staffController.updateStaff);

module.exports = router;
