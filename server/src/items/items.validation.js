const { z } = require('zod');

// Valid enum values matching Prisma ItemType and TrackingMethod
const ITEM_TYPES = ['raw_material', 'purchased_component', 'sub_assembly', 'finished_good', 'consumable'];
const TRACKING_METHODS = ['none', 'lot', 'serial'];
const SORT_FIELDS = ['partNumber', 'description', 'type', 'unitOfMeasure', 'createdAt', 'updatedAt'];

// Schema for creating a new item
const createItemSchema = z.object({
  partNumber: z.string().min(1, 'Part number is required').max(100),
  description: z.string().min(1, 'Description is required').max(500),
  type: z.enum(ITEM_TYPES, { message: `Type must be one of: ${ITEM_TYPES.join(', ')}` }),
  trackingMethod: z.enum(TRACKING_METHODS).optional().default('none'),
  unitOfMeasure: z.string().min(1, 'Unit of measure is required').max(20),
  reorderPoint: z.coerce.number().nonnegative().optional().nullable(),
  reorderQuantity: z.coerce.number().nonnegative().optional().nullable(),
  leadTimeDays: z.coerce.number().int().nonnegative().optional().nullable(),
});

// Schema for updating — same fields but all optional
const updateItemSchema = z.object({
  partNumber: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(500).optional(),
  type: z.enum(ITEM_TYPES).optional(),
  trackingMethod: z.enum(TRACKING_METHODS).optional(),
  unitOfMeasure: z.string().min(1).max(20).optional(),
  reorderPoint: z.coerce.number().nonnegative().optional().nullable(),
  reorderQuantity: z.coerce.number().nonnegative().optional().nullable(),
  leadTimeDays: z.coerce.number().int().nonnegative().optional().nullable(),
});

// Schema for query params on GET /items
const listItemsQuery = z.object({
  type: z.enum(ITEM_TYPES).optional(),
  search: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(25),
  sort: z.enum(SORT_FIELDS).optional().default('partNumber'),
  order: z.enum(['asc', 'desc']).optional().default('asc'),
});

module.exports = {
  createItemSchema,
  updateItemSchema,
  listItemsQuery,
  ITEM_TYPES,
  TRACKING_METHODS,
};
