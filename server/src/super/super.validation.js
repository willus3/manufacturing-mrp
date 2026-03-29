const { z } = require('zod');

const TENANT_STATUSES = ['active', 'suspended', 'trial'];

// Schema for listing tenants — query params
const listTenantsQuery = z.object({
  search: z.string().optional(),
  status: z.enum(TENANT_STATUSES).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(25),
  sort: z.enum(['name', 'slug', 'status', 'createdAt']).optional().default('name'),
  order: z.enum(['asc', 'desc']).optional().default('asc'),
});

// Schema for creating a new tenant + initial admin user
const createTenantSchema = z.object({
  name: z.string().min(1, 'Company name is required').max(200),
  slug: z.string()
    .min(2, 'Slug must be at least 2 characters')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens only'),
  plan: z.enum(['starter', 'professional', 'enterprise']).optional().default('starter'),
  adminEmail: z.string().email('Valid admin email is required'),
  adminPassword: z.string().min(8, 'Password must be at least 8 characters').max(128),
  adminFirstName: z.string().min(1, 'Admin first name is required').max(100),
  adminLastName: z.string().min(1, 'Admin last name is required').max(100),
});

// Schema for updating a tenant
const updateTenantSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  plan: z.enum(['starter', 'professional', 'enterprise']).optional(),
});

module.exports = {
  listTenantsQuery,
  createTenantSchema,
  updateTenantSchema,
};
