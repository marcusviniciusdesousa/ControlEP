const express = require("express");
const router = express.Router();
const passwordResetController = require("../controllers/passwordResetController");

// Navegadores não enviam corpo em requisições GET; por isso as etapas usam POST/PUT.
router
  .route("/")
  .post(passwordResetController.requestPasswordReset) // 1. solicita o código por e-mail
  .put(passwordResetController.resetPassword); // 3. define a nova senha

router.post("/verify", passwordResetController.verifyResetCode); // 2. valida o código

module.exports = router;
