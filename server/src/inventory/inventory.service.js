const { prisma } = require('../db');
const { AppError, notFoundError } = require('../utils/errors');

// Shared include for stock queries — always include item + location names
const STOCK_INCLUDE = {
  item: { select: { id: true, partNumber: true, description: true, unitOfMeasure: true } },
  location: { select: { id: true, name: true, code: true } },
};

/**
 * List inventory stock — paginated, filterable.
 * Shows ALL active items, including those with zero or no stock.
 * When filtered by location or status, only matching stock rows appear,
 * but items with no matching stock still show with qty 0.
 */
const listStock = async (tenantId, query) => {
  const { itemId, locationId, status, page, pageSize } = query;

  // Build item filter — always active items in this tenant
  const itemWhere = { tenantId, isActive: true };
  if (itemId) itemWhere.id = itemId;

  // Build stock filter for the nested include
  const stockWhere = {};
  if (locationId) stockWhere.locationId = locationId;
  if (status) stockWhere.inventoryStatus = status;

  const [total, items] = await Promise.all([
    prisma.item.count({ where: itemWhere }),
    prisma.item.findMany({
      where: itemWhere,
      select: {
        id: true,
        partNumber: true,
        description: true,
        unitOfMeasure: true,
        inventoryStocks: {
          where: stockWhere,
          include: {
            location: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: { partNumber: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  // Flatten: one row per item/location/lot/status combo.
  // Items with no stock get a single row with qty 0.
  const stock = items.flatMap((item) => {
    if (item.inventoryStocks.length === 0) {
      return [{
        id: `no-stock-${item.id}`,
        item: { id: item.id, partNumber: item.partNumber, description: item.description, unitOfMeasure: item.unitOfMeasure },
        location: null,
        quantityOnHand: 0,
        lotNumber: null,
        serialNumber: null,
        inventoryStatus: 'available',
      }];
    }
    return item.inventoryStocks.map((s) => ({
      id: s.id,
      item: { id: item.id, partNumber: item.partNumber, description: item.description, unitOfMeasure: item.unitOfMeasure },
      location: s.location,
      quantityOnHand: s.quantityOnHand,
      lotNumber: s.lotNumber,
      serialNumber: s.serialNumber,
      inventoryStatus: s.inventoryStatus,
    }));
  });

  return {
    stock,
    meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
  };
};

/** Stock summary — aggregated quantity per item (across all locations/lots). */
const stockSummary = async (tenantId, query) => {
  const where = { tenantId, quantityOnHand: { gt: 0 } };
  if (query.itemId) where.itemId = query.itemId;

  const results = await prisma.inventoryStock.groupBy({
    by: ['itemId'],
    where,
    _sum: { quantityOnHand: true },
  });

  // Enrich with item details
  const itemIds = results.map((r) => r.itemId);
  const items = await prisma.item.findMany({
    where: { id: { in: itemIds } },
    select: { id: true, partNumber: true, description: true, unitOfMeasure: true, reorderPoint: true },
  });

  const itemMap = new Map(items.map((i) => [i.id, i]));

  return results.map((r) => ({
    item: itemMap.get(r.itemId),
    totalOnHand: r._sum.quantityOnHand,
  }));
};

/** List transactions — paginated, filterable by item, location, type, date range. */
const listTransactions = async (tenantId, query) => {
  const { itemId, locationId, type, dateFrom, dateTo, page, pageSize } = query;

  const where = { tenantId };
  if (itemId) where.itemId = itemId;
  if (locationId) where.locationId = locationId;
  if (type) where.transactionType = type;
  if (dateFrom || dateTo) {
    where.performedAt = {};
    if (dateFrom) where.performedAt.gte = dateFrom;
    if (dateTo) where.performedAt.lte = dateTo;
  }

  const [total, transactions] = await Promise.all([
    prisma.inventoryTransaction.count({ where }),
    prisma.inventoryTransaction.findMany({
      where,
      include: {
        item: { select: { id: true, partNumber: true, description: true } },
        location: { select: { id: true, name: true, code: true } },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { performedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    transactions,
    meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
  };
};

/**
 * Upsert stock record — finds or creates the stock row for this
 * item/location/lot/serial/status combo, then adjusts quantity.
 */
const upsertStock = async (tx, tenantId, { itemId, locationId, lotNumber, serialNumber, inventoryStatus, quantityDelta }) => {
  // Normalize nulls for the unique constraint lookup
  const lot = lotNumber || null;
  const serial = serialNumber || null;
  const status = inventoryStatus || 'available';

  // Try to find existing stock row
  const existing = await tx.inventoryStock.findFirst({
    where: { tenantId, itemId, locationId, lotNumber: lot, serialNumber: serial, inventoryStatus: status },
  });

  if (existing) {
    const newQty = Number(existing.quantityOnHand) + quantityDelta;
    if (newQty < 0) {
      throw new AppError(400, 'INSUFFICIENT_STOCK', `Insufficient stock. Available: ${existing.quantityOnHand}`);
    }
    return tx.inventoryStock.update({
      where: { id: existing.id },
      data: { quantityOnHand: newQty },
    });
  }

  // Creating new — quantity must be positive
  if (quantityDelta < 0) {
    throw new AppError(400, 'INSUFFICIENT_STOCK', 'No stock exists for this item/location combination');
  }

  return tx.inventoryStock.create({
    data: {
      tenantId,
      itemId,
      locationId,
      lotNumber: lot,
      serialNumber: serial,
      inventoryStatus: status,
      quantityOnHand: quantityDelta,
    },
  });
};

/** Adjust inventory — creates a transaction and updates stock. */
const adjust = async (data, tenantId, userId) => {
  const { itemId, locationId, quantity, lotNumber, serialNumber, notes } = data;

  // Verify item and location exist in tenant
  const [item, location] = await Promise.all([
    prisma.item.findFirst({ where: { id: itemId, tenantId } }),
    prisma.inventoryLocation.findFirst({ where: { id: locationId, tenantId } }),
  ]);
  if (!item) throw notFoundError('Item not found');
  if (!location) throw notFoundError('Location not found');

  return prisma.$transaction(async (tx) => {
    // Create transaction record
    const transaction = await tx.inventoryTransaction.create({
      data: {
        tenantId,
        itemId,
        locationId,
        lotNumber: lotNumber || null,
        serialNumber: serialNumber || null,
        transactionType: 'adjustment',
        quantity,
        referenceType: 'manual',
        notes: notes || null,
        performedBy: userId,
        performedAt: new Date(),
      },
      include: {
        item: { select: { id: true, partNumber: true, description: true } },
        location: { select: { id: true, name: true, code: true } },
      },
    });

    // Update stock
    const stock = await upsertStock(tx, tenantId, {
      itemId,
      locationId,
      lotNumber,
      serialNumber,
      inventoryStatus: 'available',
      quantityDelta: quantity,
    });

    return { transaction, stock };
  });
};

/** Transfer inventory between locations. */
const transfer = async (data, tenantId, userId) => {
  const { itemId, fromLocationId, toLocationId, quantity, lotNumber, serialNumber } = data;

  if (fromLocationId === toLocationId) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Source and destination must be different');
  }

  // Verify all entities exist
  const [item, fromLoc, toLoc] = await Promise.all([
    prisma.item.findFirst({ where: { id: itemId, tenantId } }),
    prisma.inventoryLocation.findFirst({ where: { id: fromLocationId, tenantId } }),
    prisma.inventoryLocation.findFirst({ where: { id: toLocationId, tenantId } }),
  ]);
  if (!item) throw notFoundError('Item not found');
  if (!fromLoc) throw notFoundError('Source location not found');
  if (!toLoc) throw notFoundError('Destination location not found');

  return prisma.$transaction(async (tx) => {
    // Remove from source
    await upsertStock(tx, tenantId, {
      itemId,
      locationId: fromLocationId,
      lotNumber,
      serialNumber,
      inventoryStatus: 'available',
      quantityDelta: -quantity,
    });

    // Add to destination
    await upsertStock(tx, tenantId, {
      itemId,
      locationId: toLocationId,
      lotNumber,
      serialNumber,
      inventoryStatus: 'available',
      quantityDelta: quantity,
    });

    // Create two transaction records (one out, one in)
    const [outTxn, inTxn] = await Promise.all([
      tx.inventoryTransaction.create({
        data: {
          tenantId, itemId, locationId: fromLocationId,
          lotNumber: lotNumber || null, serialNumber: serialNumber || null,
          transactionType: 'transfer', quantity: -quantity,
          referenceType: 'manual',
          performedBy: userId, performedAt: new Date(),
        },
      }),
      tx.inventoryTransaction.create({
        data: {
          tenantId, itemId, locationId: toLocationId,
          lotNumber: lotNumber || null, serialNumber: serialNumber || null,
          transactionType: 'transfer', quantity,
          referenceType: 'manual',
          performedBy: userId, performedAt: new Date(),
        },
      }),
    ]);

    return { outTransaction: outTxn, inTransaction: inTxn };
  });
};

module.exports = { listStock, stockSummary, listTransactions, adjust, transfer, upsertStock };
