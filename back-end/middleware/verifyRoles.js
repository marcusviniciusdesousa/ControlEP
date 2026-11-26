// Middleware file to verify user permissions

const verifyRoles = (requiredPermission) => {
  return (req, res, next) => {
    if (!Array.isArray(req?.permissions)) return res.sendStatus(401); // Unauthorized

    const allowedPermissions = Array.isArray(requiredPermission)
      ? requiredPermission
      : [requiredPermission];

    // Checking if the user's permissions array contains at least one required permission
    const result = allowedPermissions.some((permission) =>
      req.permissions.includes(permission),
    );

    // If the user doesn't have the permission, block the request
    if (!result) return res.sendStatus(403); // Forbidden

    next();
  };
};

module.exports = verifyRoles;