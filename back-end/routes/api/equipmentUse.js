const express = require("express");
const router = express.Router();
const controller = require("../../controllers/equipmentUseController");
const verifyRoles = require("../../middleware/verifyRoles");
const PERMISSIONS_LIST = require("../../config/rolesPermissionsList");

const canManage = verifyRoles([PERMISSIONS_LIST.EQUIPMENT]);
const canRead = verifyRoles([PERMISSIONS_LIST.EQUIPMENT, PERMISSIONS_LIST.DASHBOARD]);

router.route("/").get(canRead, controller.getEquipmentUses).post(canManage, controller.addEquipmentUse);
router.put("/:id/return", canManage, controller.returnEquipmentUse);
router.route("/:id").put(canManage, controller.updateEquipmentUse).delete(canManage, controller.deleteEquipmentUse);

module.exports = router;
