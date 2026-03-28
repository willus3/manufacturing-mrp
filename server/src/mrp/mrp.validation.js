// MRP validation schemas (Zod).
// Covers demand CRUD, MRP run parameters, and list query parsing.

const { z } = require('zod');

const DEMAND_STATUSES = ['open', 'planned', 'fulfilled', 'cancelled'];
const MRP_ACTION_TYPES = ['purchase', 'produce'];
const MRP_RESULT_STATUSES = ['suggested', 'converted', 'dismissed'];

// --- Demand ---

const createDemandSchema = z.object({
  itemId: z.string().uuid('Invalid item ID'),
  quantityRequired: z.coerce.number().positive('Quantity must be positive'),
  dateRequired: z.coerce.date({ required_error: 'Date required is mandatory' }),
  notes: z.string().max(2000).optional().nullable(),
});

const updateDemandSchema = z.object({
  quantityRequired: z.coerce.number().positive('Quantity must be positive').optional(),
  dateRequired: z.coerce.date().optional(),
  notes: z.string().max(2000).optional().nullable(),
});

const listDemandQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(DEMAND_STATUSES).optional(),
  itemId: z.string().uuid().optional(),
});

// --- MRP Run ---

const runMrpSchema = z.object({
  planningHorizonDays: z.coerce.number().int().min(1).max(365).default(90),
});

const listRunsQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const listResultsQuery = z.object({
  actionType: z.enum(MRP_ACTION_TYPES).optional(),
  status: z.enum(MRP_RESULT_STATUSES).optional(),
});

module.exports = {
  DEMAND_STATUSES,
  MRP_ACTION_TYPES,
  MRP_RESULT_STATUSES,
  createDemandSchema,
  updateDemandSchema,
  listDemandQuery,
  runMrpSchema,
  listRunsQuery,
  listResultsQuery,
};
