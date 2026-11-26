// Controller file to manage Refresh Tokens

const db = require("../db");
const { queries: q } = require("./queries/queries");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const handleRefreshToken = async (req, res) => {
  const cookies = req.cookies;

  if (!cookies?.refreshToken) return res.sendStatus(401);

  const refreshToken = cookies.refreshToken;

  try {
    const hashToken = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    const { rows } = await db.query(q.qSelectRefreshToken, [hashToken]);
    const foundUser = rows[0];

    if (!foundUser) return res.sendStatus(403);

    const { rows: permissionRows } = await db.query(
      q.qSelectPermissionsByRoleId,
      [foundUser.id_role],
    );
    const permissions = permissionRows.map((p) => p.name);

    jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, decoded) => {
      if (err || foundUser.name !== decoded.username) return res.sendStatus(403);

      const accessToken = jwt.sign(
        {
          userInfo: {
            userId: foundUser.id,
            username: foundUser.name,
            role: foundUser.id_role,
            permissions,
          },
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "5m" },
      );

      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 5 * 60 * 1000,
      });

      return res.sendStatus(200);
    });
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
};

module.exports = { handleRefreshToken };