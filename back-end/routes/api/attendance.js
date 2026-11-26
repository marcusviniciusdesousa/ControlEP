const express = require("express");
const router = express.Router();
const attendanceController = require("../../controllers/attendanceController");
const verifyRoles = require("../../middleware/verifyRoles");
const PERMISSIONS_LIST = require("../../config/rolesPermissionsList");

const canManage = verifyRoles([PERMISSIONS_LIST.ATTENDANCE]);
const canRead = verifyRoles([PERMISSIONS_LIST.ATTENDANCE, PERMISSIONS_LIST.DASHBOARD]);

router
  .route("/")
  .get(canRead, attendanceController.getAttendance) // ?date= | ?from=&to= | ?id_employee=
  .post(canManage, attendanceController.addAttendance) // cria ou atualiza
  .put(canManage, attendanceController.updateAttendance); // cria ou atualiza

router.post("/all", canManage, attendanceController.markAllPresent); // marcar todos presentes

router.delete("/:id", canManage, attendanceController.deleteAttendance); // volta para "Não informado"

module.exports = router;
