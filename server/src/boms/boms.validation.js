const { z } = require('zod');

const BOM_STATUSES = ['draft', 'active', 'obsolete'];
const SORT_FIELDS = ['createdAt', 'updatedAt', 'revision', 'status'];

// Schema for a single BOM line (used inside create/update)
const bomLineSchema = z.object({
  itemId: z.string().uuid('Invalid item ID'),
  quantity: z.coerce.number().positive('Quantity must be positive'),
  unitOfMeasure: z.string().min(1, 'Unit of measure is required').max(20),
  position: z.coerce.number().int().nonnegative().optional().nullable(),
  scrapFactor: z.coerce.number().min(0).max(1).optional().default(0),
  notes: z.string().max(500).optional().nullable(),
});

/** Schema for creating a new BOM with lines. */
const createBomSchema = z.object({
  itemId: z.string().uuid('Invalid item ID'),
  revision: z.string().min(1, 'Revision is required').max(50),
  effectiveDate: z.coerce.date().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  lines: z.array(bomLineSchema).min(1, 'At least one BOM line is required'),
});

/** Schema for updating a BOM (header + lines replaced). */
const updateBomSchema = z.object({
  revision: z.string().min(1).max(50).optional(),
  effectiveDate: z.coerce.date().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  lines: z.array(bomLineSchema).min(1, 'At least one BOM line is required').optional(),
});

/** Schema for status change. */
const changeStatusSchema = z.object({
  status: z.enum(BOM_STATUSES, { message: `Status must be one of: ${BOM_STATUSES.join(', ')}` }),
});

/** Schema for query params on GET /boms. */
const listBomsQuery = z.object({
  itemId: z.string().uuid().optional(),
  status: z.enum(BOM_STATUSES).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(25),
  sort: z.enum(SORT_FIELDS).optional().default('createdAt'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
});

module.exports = {
  createBomSchema,
  updateBomSchema,
  changeStatusSchema,
  listBomsQuery,
  BOM_STATUSES,
};
