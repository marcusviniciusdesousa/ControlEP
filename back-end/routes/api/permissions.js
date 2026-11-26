const express = require("express");
const router = express.Router();
const permissionsController = require("../../controllers/permissionsController");
const verifyRoles = require("../../middleware/verifyRoles");
const PERMISSIONS_LIST = require("../../config/rolesPermissionsList");

const canManageRoles = verifyRoles([PERMISSIONS_LIST.ROLES]);

router.get("/", canManageRoles, permissionsController.getAllPermissions); // Todas as permissões

// Rota usada pelo front-end
router.get("/roles/:id_role", canManageRoles, permissionsController.getPermissionsByRoleID);

router
  .route("/:id_role/:id_permission")
  .put(canManageRoles, permissionsController.addPermissionToRole) // Adiciona permissão ao papel
  .delete(canManageRoles, permissionsController.deletePermissionFromRole); // Remove permissão do papel

router.get("/:id_role", canManageRoles, permissionsController.getPermissionsByRoleID);

module.exports = router;
