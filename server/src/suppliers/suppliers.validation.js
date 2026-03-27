const { z } = require('zod');

const SORT_FIELDS = ['name', 'code', 'contactName', 'createdAt', 'updatedAt'];

/** Schema for creating a new supplier. */
const createSupplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required').max(200),
  code: z.string().max(50).optional().nullable(),
  contactName: z.string().max(200).optional().nullable(),
  contactEmail: z.string().email('Invalid email').max(200).optional().nullable(),
  contactPhone: z.string().max(50).optional().nullable(),
  address: z.string().max(1000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

/** Schema for updating a supplier — all fields optional. */
const updateSupplierSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  code: z.string().max(50).optional().nullable(),
  contactName: z.string().max(200).optional().nullable(),
  contactEmail: z.string().email('Invalid email').max(200).optional().nullable(),
  contactPhone: z.string().max(50).optional().nullable(),
  address: z.string().max(1000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

/** Schema for query params on GET /suppliers. */
const listSuppliersQuery = z.object({
  search: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(25),
  sort: z.enum(SORT_FIELDS).optional().default('name'),
  order: z.enum(['asc', 'desc']).optional().default('asc'),
});

module.exports = {
  createSupplierSchema,
  updateSupplierSchema,
  listSuppliersQuery,
};
