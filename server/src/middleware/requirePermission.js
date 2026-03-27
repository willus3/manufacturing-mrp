const { forbiddenError } = require('../utils/errors');

// Higher-order function that creates permission-checking middleware.
// Reads the permissions array from req.user (set by authenticate middleware)
// and checks if the required permission is present.
//
// Usage in routes:
//   router.get('/items', authenticate, requirePermission('item:read'), controller.list)
//
// Super admins automatically pass all permission checks.
//
const requirePermission = (permissionCode) => (req, res, next) => {
  // Super admins can do anything
  if (req.user.isSuperAdmin) {
    return next();
  }

  // Check if the user's permissions include the required one
  if (req.user.permissions.includes(permissionCode)) {
    return next();
  }

  next(forbiddenError(`Missing required permission: ${permissionCode}`));
};

module.exports = { requirePermission };
