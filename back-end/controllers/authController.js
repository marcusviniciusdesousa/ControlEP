// Authentication controller, for user login

const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

// Importing database
const db = require("../db");

// Importing SQL queries
const { queries: q } = require("./queries/queries");

// Importing data validation
const validate = require("../helpers/dataValidation");

// Function to handle login
const handleLogin = async (req, res) => {
  const { email_usuario, senha_usuario } = req.body;

  // If email or password are missing, return error
  if (!email_usuario || !senha_usuario)
    return res.status(400).json({ message: "Email e senha são necessários." });

  // Validating user data
  if (
    !validate.validateEmail(email_usuario) ||
    !validate.validatePassword(senha_usuario)
  )
    return res.status(401).json({
      message: "Dados inválidos",
    });

  // Looking for user in database via email
  try {
    // Searching for match
    const { rows } = await db.query(q.qSelectUserByEmail, [
      email_usuario.toLowerCase(),
    ]);
    const user = rows[0];

    // Send error message if user isn't found
    if (!user) {
      return res.status(400).json({
        message: `Usuário com email ${email_usuario} não encontrado`,
      });
    }

    // Send error message if user isn't approved yet
    if (!user.status_active) {
      return res.status(400).json({
        message: "Usuário não está aprovado, entre em contato com um supervisor",
      });
    }

    // If user exists, check if the password matches
    const match = await bcrypt.compare(senha_usuario, user.password_hash);

    // If match happens, create JSON Web Tokens
    if (match) {
      // Fetching the permissions that belong to the user's role
      const { rows: permissionRows } = await db.query(
        q.qSelectPermissionsByRoleId,
        [user.id_role],
      );

      const permissions = permissionRows.map((p) => p.name);

      // Creating Access Token
      const accessToken = jwt.sign(
        {
          userInfo: {
            userId: user.id,
            username: user.name,
            role: user.id_role,
            permissions,
          },
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "5m" },
      );

      // Creating Refresh Token
      const refreshToken = jwt.sign(
        {
          userId: user.id,
          username: user.name,
          role: user.id_role,
        },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: "15m" },
      );

      // Calculating expiration date (24 hours)
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const pad = (n) => String(n).padStart(2, "0");
      const expirationDate = `${expiresAt.getFullYear()}-${pad(expiresAt.getMonth() + 1)}-${pad(expiresAt.getDate())} ${pad(expiresAt.getHours())}:${pad(expiresAt.getMinutes())}:00`;

      // Hashing refresh token
      const hashToken = crypto
        .createHash("sha256")
        .update(refreshToken)
        .digest("hex");

      // Inserting refreshToken in database
      await db.query(q.qAddRefreshToken, [
        user.id,
        hashToken,
        expirationDate,
      ]);

      // Sending Refresh Token as httpOnly cookie
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 15 * 60 * 1000,
      });

      // Sending Access Token as cookie
      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 5 * 60 * 1000,
      });

      return res.status(200).json({
        userId: user.id,
        username: user.name,
        role: user.id_role,
      });
    } else {
      return res.sendStatus(401);
    }
  } catch (err) {
    console.error(err.message);
    console.error(err.position);
    if (!res.headersSent) {
      return res.status(500).json(err);
    }
  }
};

module.exports = { handleLogin };