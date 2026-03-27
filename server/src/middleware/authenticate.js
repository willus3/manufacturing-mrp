const { verifyAccessToken } = require('../utils/tokens');
const { unauthorizedError } = require('../utils/errors');

// Validates the JWT from the Authorization header and attaches
// the decoded user info to req.user for downstream handlers.
//
// After this middleware runs, you can access:
//   req.user.userId      — the logged-in user's ID
//   req.user.tenantId    — which tenant they belong to
//   req.user.permissions — array of permission codes like ['bom:read', 'item:write']
//   req.user.isSuperAdmin — whether they're a platform super admin
//
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // Expect: "Bearer <token>"
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(unauthorizedError('Missing or malformed Authorization header'));
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyAccessToken(token);

  // Attach user info to the request for downstream middleware/handlers
  req.user = {
    userId: decoded.userId,
    tenantId: decoded.tenantId,
    permissions: decoded.permissions || [],
    isSuperAdmin: decoded.isSuperAdmin || false,
  };

  next();
};

module.exports = { authenticate };
