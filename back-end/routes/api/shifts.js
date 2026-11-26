const express = require("express");
const router = express.Router();
const shiftsController = require("../../controllers/shiftsController");
const verifyRoles = require("../../middleware/verifyRoles");
const PERMISSIONS_LIST = require("../../config/rolesPermissionsList");

const canManage = verifyRoles([PERMISSIONS_LIST.SHIFTS]);
// Listagem também é usada nos cadastros de funcionários e na tela de presença
const canRead = verifyRoles([
  PERMISSIONS_LIST.SHIFTS,
  PERMISSIONS_LIST.EMPLOYEE,
  PERMISSIONS_LIST.ATTENDANCE,
]);

router
  .route("/")
  .get(canRead, shiftsController.getAllShifts)
  .post(canManage, shiftsController.addShift)
  .put(canManage, shiftsController.updateShift);

router.delete("/:id", canManage, shiftsController.deleteShift);

module.exports = router;
