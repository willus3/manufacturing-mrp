// Work Order validation schemas (Zod).
// Covers create, update, status change, material issue, and list query parsing.

const { z } = require('zod');

const WO_STATUSES = ['planned', 'released', 'in_progress', 'completed', 'cancelled'];

// Valid status transitions (from → allowed targets)
const VALID_TRANSITIONS = {
  planned: ['released', 'cancelled'],
  released: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
};

// --- Create WO ---

const createWOSchema = z.object({
  bomId: z.string().uuid('Invalid BOM ID'),
  quantity: z.coerce.number().positive('Quantity must be positive'),
  priority: z.coerce.number().int().min(0).default(0),
  scheduledStart: z.coerce.date().optional().nullable(),
  scheduledEnd: z.coerce.date().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// --- Update WO (planned only) ---

const updateWOSchema = z.object({
  quantity: z.coerce.number().positive('Quantity must be positive').optional(),
  priority: z.coerce.number().int().min(0).optional(),
  scheduledStart: z.coerce.date().optional().nullable(),
  scheduledEnd: z.coerce.date().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// --- Status change ---

const statusChangeSchema = z.object({
  status: z.enum(['released', 'in_progress', 'completed', 'cancelled']),
});

// --- Material issue lines ---

const issueLineSchema = z.object({
  woLineId: z.string().uuid('Invalid WO line ID'),
  quantity: z.coerce.number().positive('Issue quantity must be positive'),
  locationId: z.string().uuid('Invalid location ID'),
  lotNumber: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
});

const issueSchema = z.object({
  lines: z.array(issueLineSchema).min(1, 'At least one line is required'),
});

// --- List query ---

const listWOQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.enum(['woNumber', 'status', 'priority', 'scheduledStart', 'scheduledEnd', 'createdAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  status: z.enum(WO_STATUSES).optional(),
  priority: z.coerce.number().int().min(0).optional(),
});

module.exports = {
  WO_STATUSES,
  VALID_TRANSITIONS,
  createWOSchema,
  updateWOSchema,
  statusChangeSchema,
  issueSchema,
  listWOQuery,
};
