const { z } = require('zod');

// Validation schemas for auth endpoints.
// These are used with the validate() middleware to ensure
// request bodies have the right shape before hitting the controller.

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  tenantSlug: z.string().min(1, 'Tenant slug is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

module.exports = { loginSchema, refreshSchema };
