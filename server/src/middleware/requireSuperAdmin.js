const { forbiddenError } = require('../utils/errors');

// Middleware that restricts access to super admin users only.
// Must be used after the authenticate middleware (needs req.user).
const requireSuperAdmin = (req, res, next) => {
  if (req.user.isSuperAdmin) {
    return next();
  }

  next(forbiddenError('Super admin access required'));
};

module.exports = { requireSuperAdmin };
