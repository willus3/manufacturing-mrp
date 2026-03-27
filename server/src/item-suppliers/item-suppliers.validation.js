const { z } = require('zod');

/** Schema for creating an item-supplier link. */
const createItemSupplierSchema = z.object({
  supplierId: z.string().uuid('Invalid supplier ID'),
  supplierPartNumber: z.string().max(100).optional().nullable(),
  unitCost: z.coerce.number().nonnegative().optional().nullable(),
  leadTimeDays: z.coerce.number().int().nonnegative().optional().nullable(),
  isPreferred: z.boolean().optional().default(false),
  minOrderQuantity: z.coerce.number().nonnegative().optional().nullable(),
});

/** Schema for updating an item-supplier link — all fields optional. */
const updateItemSupplierSchema = z.object({
  supplierPartNumber: z.string().max(100).optional().nullable(),
  unitCost: z.coerce.number().nonnegative().optional().nullable(),
  leadTimeDays: z.coerce.number().int().nonnegative().optional().nullable(),
  isPreferred: z.boolean().optional(),
  minOrderQuantity: z.coerce.number().nonnegative().optional().nullable(),
});

module.exports = {
  createItemSupplierSchema,
  updateItemSupplierSchema,
};
