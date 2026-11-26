const express = require("express");
const router = express.Router();
const equipmentController = require("../../controllers/equipmentController");
const verifyRoles = require("../../middleware/verifyRoles");
const PERMISSIONS_LIST = require("../../config/rolesPermissionsList");

const canManage = verifyRoles([PERMISSIONS_LIST.EQUIPMENT]);
const canRead = verifyRoles([PERMISSIONS_LIST.EQUIPMENT, PERMISSIONS_LIST.DASHBOARD]);

router
  .route("/")
  .get(canRead, equipmentController.getAllEquipment)
  .post(canManage, equipmentController.addEquipment)
  .put(canManage, equipmentController.updateEquipment);

// Precisa vir antes de "/:id" para não ser interpretado como ID
router.put("/status", canManage, equipmentController.updateEquipmentStatus);

router.get("/:id/history", canRead, equipmentController.getEquipmentHistory);

router
  .route("/:id")
  .get(canRead, equipmentController.getEquipmentByID)
  .delete(canManage, equipmentController.deleteEquipment);

module.exports = router;
