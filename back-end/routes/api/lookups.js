const express = require("express");
const router = express.Router();
const lookupsController = require("../../controllers/lookupsController");

// Disponível para qualquer usuário autenticado (dados de referência, sem informação sensível)
router.get("/", lookupsController.getLookups);

module.exports = router;
