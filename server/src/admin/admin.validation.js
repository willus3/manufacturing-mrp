const { z } = require('zod');

// Schema for listing users — query params
const listUsersQuery = z.object({
  search: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(25),
  sort: z.enum(['firstName', 'lastName', 'email', 'createdAt']).optional().default('firstName'),
  order: z.enum(['asc', 'desc']).optional().default('asc'),
});

// Schema for creating a new user
const createUserSchema = z.object({
  email: z.string().email('Valid email is required'),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  roleIds: z.array(z.string().uuid()).min(1, 'At least one role is required'),
});

// Schema for updating a user — password is optional (omit to leave unchanged)
const updateUserSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  password: z.string().min(8).max(128).optional(),
  roleIds: z.array(z.string().uuid()).min(1).optional(),
});

// Schema for creating a custom role
const createRoleSchema = z.object({
  name: z.string().min(1, 'Role name is required').max(100),
  permissionIds: z.array(z.string().uuid()).min(1, 'At least one permission is required'),
});

// Schema for updating a role
const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  permissionIds: z.array(z.string().uuid()).min(1).optional(),
});

module.exports = {
  listUsersQuery,
  createUserSchema,
  updateUserSchema,
  createRoleSchema,
  updateRoleSchema,
};
