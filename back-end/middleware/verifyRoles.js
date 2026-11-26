// Middleware que exige ao menos uma das permissões informadas.

const verifyRoles = (requiredPermission) => {
  return (req, res, next) => {
    if (!Array.isArray(req?.permissions)) {
      return res.status(401).json({ message: "Sessão expirada." });
    }

    const allowedPermissions = Array.isArray(requiredPermission)
      ? requiredPermission
      : [requiredPermission];

    const allowed = allowedPermissions.some((permission) =>
      req.permissions.includes(permission),
    );

    if (!allowed) {
      return res
        .status(403)
        .json({ message: "Você não tem permissão para realizar esta ação." });
    }

    next();
  };
};

module.exports = verifyRoles;
