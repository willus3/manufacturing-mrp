const { z } = require('zod');

const INVENTORY_STATUSES = ['available', 'allocated', 'issued', 'in_transit', 'quarantine'];
const TRANSACTION_TYPES = ['receipt', 'issue', 'adjustment', 'transfer', 'scrap'];

/** Query params for GET /inventory/stock. */
const listStockQuery = z.object({
  itemId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  status: z.enum(INVENTORY_STATUSES).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(25),
});

/** Query params for GET /inventory/stock/summary. */
const stockSummaryQuery = z.object({
  itemId: z.string().uuid().optional(),
});

/** Query params for GET /inventory/transactions. */
const listTransactionsQuery = z.object({
  itemId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  type: z.enum(TRANSACTION_TYPES).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(25),
});

/** Schema for POST /inventory/adjust. */
const adjustSchema = z.object({
  itemId: z.string().uuid('Invalid item ID'),
  locationId: z.string().uuid('Invalid location ID'),
  quantity: z.coerce.number().refine((n) => n !== 0, 'Quantity cannot be zero'),
  lotNumber: z.string().max(100).optional().nullable(),
  serialNumber: z.string().max(100).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

/** Schema for POST /inventory/transfer. */
const transferSchema = z.object({
  itemId: z.string().uuid('Invalid item ID'),
  fromLocationId: z.string().uuid('Invalid source location ID'),
  toLocationId: z.string().uuid('Invalid destination location ID'),
  quantity: z.coerce.number().positive('Quantity must be positive'),
  lotNumber: z.string().max(100).optional().nullable(),
  serialNumber: z.string().max(100).optional().nullable(),
});

/** Schema for a single row in the inventory import CSV.
 * Uses human-readable partNumber + locationCode (resolved server-side).
 */
const inventoryImportRowSchema = z.object({
  partNumber: z.string().min(1, 'partNumber is required').max(100),
  locationCode: z.string().min(1, 'locationCode is required').max(50),
  quantity: z.coerce.number().positive('Quantity must be positive'),
  lotNumber: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});

module.exports = {
  listStockQuery,
  stockSummaryQuery,
  listTransactionsQuery,
  adjustSchema,
  transferSchema,
  inventoryImportRowSchema,
};
