// Extracts the tenantId from the authenticated user's JWT and makes it
// available as req.tenantId. Every service function uses this to filter
// database queries to the correct tenant.
//
// Think of it like a factory badge — once this middleware runs, every
// piece of data is automatically filtered to the logged-in user's shop.
//
// Super admins bypass tenant scoping — they can operate across tenants
// by passing an X-Tenant-Id header.
//
const { unauthorizedError } = require('../utils/errors');

const tenantScope = (req, res, next) => {
  if (req.user.isSuperAdmin) {
    // Super admins can target a specific tenant via header, or operate globally
    req.tenantId = req.headers['x-tenant-id'] || null;
  } else {
    // Regular users must have a tenantId — if they don't, something is wrong
    if (!req.user.tenantId) {
      return next(unauthorizedError('User is not associated with a tenant'));
    }
    req.tenantId = req.user.tenantId;
  }

  next();
};

module.exports = { tenantScope };
