const express = require("express");
const router = express.Router();
const dashboardController = require("../../controllers/dashboardController");
const verifyRoles = require("../../middleware/verifyRoles");
const PERMISSIONS_LIST = require("../../config/rolesPermissionsList");

// GET /dashboard?from=AAAA-MM-DD&to=AAAA-MM-DD
router.get("/", verifyRoles([PERMISSIONS_LIST.DASHBOARD]), dashboardController.getDashboard);

module.exports = router;
