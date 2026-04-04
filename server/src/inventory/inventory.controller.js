const { prisma } = require('../db');
const inventoryService = require('./inventory.service');
const { sendSuccess } = require('../utils/response');
const { AppError } = require('../utils/errors');
const { parseAndValidate } = require('../utils/csvImport');
const {
  listStockQuery,
  stockSummaryQuery,
  listTransactionsQuery,
  inventoryImportRowSchema,
} = require('./inventory.validation');

/** GET /inventory/stock — paginated stock list. */
const listStock = async (req, res, next) => {
  try {
    const query = listStockQuery.parse(req.query);
    const { stock, meta } = await inventoryService.listStock(req.tenantId, query);
    sendSuccess(res, stock, meta);
  } catch (err) {
    next(err);
  }
};

/** GET /inventory/stock/summary — aggregated per item. */
const stockSummary = async (req, res, next) => {
  try {
    const query = stockSummaryQuery.parse(req.query);
    const summary = await inventoryService.stockSummary(req.tenantId, query);
    sendSuccess(res, summary);
  } catch (err) {
    next(err);
  }
};

/** GET /inventory/transactions — paginated transaction log. */
const listTransactions = async (req, res, next) => {
  try {
    const query = listTransactionsQuery.parse(req.query);
    const { transactions, meta } = await inventoryService.listTransactions(req.tenantId, query);
    sendSuccess(res, transactions, meta);
  } catch (err) {
    next(err);
  }
};

/** POST /inventory/adjust — create adjustment. */
const adjust = async (req, res, next) => {
  try {
    const result = await inventoryService.adjust(req.body, req.tenantId, req.user.userId);
    sendSuccess(res, result, null, 201);
  } catch (err) {
    next(err);
  }
};

/** POST /inventory/transfer — move stock between locations. */
const transfer = async (req, res, next) => {
  try {
    const result = await inventoryService.transfer(req.body, req.tenantId, req.user.userId);
    sendSuccess(res, result, null, 201);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /inventory/import — bulk inventory receipt from CSV.
 * CSV columns: partNumber, locationCode, quantity, lotNumber (opt), notes (opt)
 * Resolves human-readable partNumber + locationCode to IDs server-side.
 * Each valid row creates an InventoryTransaction (receipt) and upserts InventoryStock.
 * Partial success: row-level errors don't abort the whole import.
 */
const importInventory = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError(400, 'VALIDATION_ERROR', 'No CSV file uploaded');
    }

    const { valid, errors: parseErrors } = parseAndValidate(req.file.buffer, inventoryImportRowSchema);

    if (valid.length === 0) {
      return sendSuccess(res, {
        imported: 0,
        skipped: null,
        errors: parseErrors.length > 0 ? parseErrors : null,
        totalRows: parseErrors.length,
      });
    }

    // Batch-resolve all partNumbers and locationCodes to IDs (avoid N+1)
    const uniquePartNumbers = [...new Set(valid.map((r) => r.partNumber))];
    const uniqueLocationCodes = [...new Set(valid.map((r) => r.locationCode))];

    const [itemRecords, locationRecords] = await Promise.all([
      prisma.item.findMany({
        where: { tenantId: req.tenantId, partNumber: { in: uniquePartNumbers } },
        select: { id: true, partNumber: true },
      }),
      prisma.inventoryLocation.findMany({
        where: { tenantId: req.tenantId, code: { in: uniqueLocationCodes }, isActive: true },
        select: { id: true, code: true },
      }),
    ]);

    const itemMap = new Map(itemRecords.map((i) => [i.partNumber, i.id]));
    const locationMap = new Map(locationRecords.map((l) => [l.code, l.id]));

    // Resolve each valid row to IDs, collecting errors for unresolvable references
    const rowErrors = [...parseErrors];
    const resolvedRows = [];

    valid.forEach((row, idx) => {
      // Row number: header = 1, first data row = 2; parseErrors already consumed some rows
      const rowNum = idx + 2;
      const itemId = itemMap.get(row.partNumber);
      const locationId = locationMap.get(row.locationCode);

      if (!itemId) {
        rowErrors.push({ row: rowNum, message: `partNumber not found: "${row.partNumber}"` });
        return;
      }
      if (!locationId) {
        rowErrors.push({ row: rowNum, message: `locationCode not found or inactive: "${row.locationCode}"` });
        return;
      }

      resolvedRows.push({ ...row, itemId, locationId, rowNum });
    });

    // Process each resolved row — per-row transaction so one failure doesn't abort the rest
    let imported = 0;
    const writeErrors = [];

    for (const row of resolvedRows) {
      try {
        await prisma.$transaction(async (tx) => {
          // Upsert stock using the shared service helper
          await inventoryService.upsertStock(tx, req.tenantId, {
            itemId: row.itemId,
            locationId: row.locationId,
            lotNumber: row.lotNumber || null,
            serialNumber: null,
            inventoryStatus: 'available',
            quantityDelta: row.quantity,
          });

          // Create audit transaction record
          await tx.inventoryTransaction.create({
            data: {
              tenantId: req.tenantId,
              itemId: row.itemId,
              locationId: row.locationId,
              lotNumber: row.lotNumber || null,
              serialNumber: null,
              transactionType: 'receipt',
              quantity: row.quantity,
              referenceType: 'manual',
              notes: row.notes || 'CSV import',
              performedBy: req.user.userId,
              performedAt: new Date(),
            },
          });
        });
        imported++;
      } catch (err) {
        writeErrors.push({ row: row.rowNum, message: err.message });
      }
    }

    const allErrors = [...rowErrors, ...writeErrors];
    const skippedCount = resolvedRows.length - imported;

    sendSuccess(res, {
      imported,
      skipped: skippedCount > 0 ? [`${skippedCount} row(s) failed during save`] : null,
      errors: allErrors.length > 0 ? allErrors : null,
      totalRows: valid.length + parseErrors.length,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { listStock, stockSummary, listTransactions, adjust, transfer, importInventory };
