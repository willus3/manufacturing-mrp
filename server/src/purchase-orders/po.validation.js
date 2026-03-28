// Purchase Order validation schemas (Zod).
// Covers create, update, send, cancel, receive, and list query parsing.

const { z } = require('zod');

const PO_STATUSES = ['draft', 'sent', 'partial', 'received', 'cancelled'];

// --- Line schemas ---

const poLineSchema = z.object({
  itemId: z.string().uuid('Invalid item ID'),
  quantityOrdered: z.coerce.number().positive('Quantity must be positive'),
  unitCost: z.coerce.number().min(0, 'Unit cost cannot be negative').optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// --- Create / Update PO ---

const createPOSchema = z.object({
  supplierId: z.string().uuid('Invalid supplier ID'),
  orderDate: z.coerce.date().optional().nullable(),
  expectedDate: z.coerce.date().optional().nullable(),
  notes: z.string().optional().nullable(),
  lines: z.array(poLineSchema).min(1, 'At least one line is required'),
});

const updatePOSchema = z.object({
  supplierId: z.string().uuid('Invalid supplier ID').optional(),
  orderDate: z.coerce.date().optional().nullable(),
  expectedDate: z.coerce.date().optional().nullable(),
  notes: z.string().optional().nullable(),
  lines: z.array(poLineSchema).min(1, 'At least one line is required').optional(),
});

// --- Receive lines ---

const receiveLineSchema = z.object({
  poLineId: z.string().uuid('Invalid PO line ID'),
  quantity: z.coerce.number().positive('Receive quantity must be positive'),
  locationId: z.string().uuid('Invalid location ID'),
  lotNumber: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const receiveSchema = z.object({
  lines: z.array(receiveLineSchema).min(1, 'At least one line is required'),
});

// --- List query ---

const listPOQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.enum(['poNumber', 'status', 'orderDate', 'expectedDate', 'createdAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  status: z.enum(PO_STATUSES).optional(),
  supplierId: z.string().uuid().optional(),
});

module.exports = {
  PO_STATUSES,
  poLineSchema,
  createPOSchema,
  updatePOSchema,
  receiveSchema,
  listPOQuery,
};
