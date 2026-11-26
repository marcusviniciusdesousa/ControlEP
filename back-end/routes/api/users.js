const express = require("express");
const router = express.Router();
const usersController = require("../../controllers/usersController");
const verifyRoles = require("../../middleware/verifyRoles");
const PERMISSIONS_LIST = require("../../config/rolesPermissionsList");

const canManageUsers = verifyRoles([PERMISSIONS_LIST.USER]);

router
  .route("/")
  .get(canManageUsers, usersController.getAllUsers) // Lista todos os usuários
  .put(canManageUsers, usersController.updateUser); // Atualiza nome, e-mail e papel

router.put("/:id/approve", canManageUsers, usersController.approveUser); // Aprova cadastro e define papel
router.put("/:id/reject", canManageUsers, usersController.rejectUser); // Recusa cadastro
router.put("/:id/status", canManageUsers, usersController.setUserStatus); // Ativa/desativa

router
  .route("/:id")
  .get(canManageUsers, usersController.getUserByID)
  .put(canManageUsers, usersController.setUserStatus) // Compatibilidade: alterna status
  .delete(canManageUsers, usersController.deleteUser);

module.exports = router;
