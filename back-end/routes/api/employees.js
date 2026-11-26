const express = require("express");
const router = express.Router();
const employeesController = require("../../controllers/employeesController");
const verifyRoles = require("../../middleware/verifyRoles");
const PERMISSIONS_LIST = require("../../config/rolesPermissionsList");

const canManage = verifyRoles([PERMISSIONS_LIST.EMPLOYEE]);
// A tela de presença precisa listar funcionários mesmo sem a permissão de cadastro
const canRead = verifyRoles([PERMISSIONS_LIST.EMPLOYEE, PERMISSIONS_LIST.ATTENDANCE, PERMISSIONS_LIST.DASHBOARD]);

router
  .route("/")
  .get(canRead, employeesController.getAllEmployees)
  .post(canManage, employeesController.addEmployee)
  .put(canManage, employeesController.updateEmployee);

router.put("/:id/status", canManage, employeesController.setEmployeeStatus); // Ativar/desativar

router
  .route("/:id")
  .get(canRead, employeesController.getEmployeeByID)
  .delete(canManage, employeesController.deleteEmployee);

// Rota legada (apenas desativa). Mantida por compatibilidade; o usuário da URL é ignorado.
router.put("/:id/:id_user", canManage, employeesController.deactivateEmployee);

module.exports = router;
