// Work Order service — business logic for WO lifecycle.
// Handles auto-numbering, CRUD, status transitions, material issue,
// and completion (which creates an inventory receipt for the finished item).

const { prisma } = require('../db');
const { AppError, notFoundError } = require('../utils/errors');
const { VALID_TRANSITIONS } = require('./wo.validation');

// ---------- Helpers ----------

/** Generate next WO number for a tenant (WO-0001, WO-0002, ...) */
const generateWONumber = async (tenantId) => {
  const last = await prisma.workOrder.findFirst({
    where: { tenantId },
    orderBy: { woNumber: 'desc' },
    select: { woNumber: true },
  });

  if (!last) return 'WO-0001';

  const num = parseInt(last.woNumber.replace('WO-', ''), 10);
  return `WO-${String(num + 1).padStart(4, '0')}`;
};

/**
 * Upsert stock — mirrors the inventory/PO service pattern.
 * Finds or creates a stock row, then adjusts quantity.
 */
const upsertStock = async (tx, tenantId, { itemId, locationId, lotNumber, serialNumber, quantityDelta }) => {
  const lot = lotNumber || null;
  const serial = serialNumber || null;
  const status = 'available';

  const existing = await tx.inventoryStock.findFirst({
    where: { tenantId, itemId, locationId, lotNumber: lot, serialNumber: serial, inventoryStatus: status },
  });

  if (existing) {
    const newQty = Number(existing.quantityOnHand) + quantityDelta;
    if (newQty < 0) {
      throw new AppError(400, 'INSUFFICIENT_STOCK', 'Not enough stock to issue');
    }
    return tx.inventoryStock.update({
      where: { id: existing.id },
      data: { quantityOnHand: newQty },
    });
  }

  // For issues (negative delta), can't create a new row with negative qty
  if (quantityDelta < 0) {
    throw new AppError(400, 'INSUFFICIENT_STOCK', 'No stock found at this location for this item');
  }

  return tx.inventoryStock.create({
    data: { tenantId, itemId, locationId, lotNumber: lot, serialNumber: serial, inventoryStatus: status, quantityOnHand: quantityDelta },
  });
};

// ---------- CRUD ----------

/** List WOs with pagination and filters. */
const list = async (tenantId, query) => {
  const { page, pageSize, sort, order, status, priority } = query;
  const where = { tenantId };
  if (status) where.status = status;
  if (priority !== undefined) where.priority = priority;

  const [data, total] = await Promise.all([
    prisma.workOrder.findMany({
      where,
      orderBy: { [sort]: order },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        bom: {
          select: {
            id: true,
            revision: true,
            item: { select: { id: true, partNumber: true, description: true } },
          },
        },
        _count: { select: { lines: true } },
      },
    }),
    prisma.workOrder.count({ where }),
  ]);

  return {
    workOrders: data,
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
};

/** Get single WO with lines (including item details). */
const getById = async (id, tenantId) => {
  const wo = await prisma.workOrder.findFirst({
    where: { id, tenantId },
    include: {
      bom: {
        select: {
          id: true,
          revision: true,
          item: { select: { id: true, partNumber: true, description: true, unitOfMeasure: true } },
        },
      },
      creator: { select: { id: true, firstName: true, lastName: true } },
      lines: {
        include: {
          item: { select: { id: true, partNumber: true, description: true, unitOfMeasure: true } },
          location: { select: { id: true, code: true, name: true } },
        },
      },
    },
  });

  if (!wo) throw notFoundError('Work order not found');
  return wo;
};

/**
 * Create a new WO from a BOM.
 * Auto-generates WO number and material lines from BOM lines.
 * Each line qty = BOM line qty x WO qty x (1 + scrapFactor).
 */
const create = async (data, tenantId, userId) => {
  const { bomId, quantity, priority, scheduledStart, scheduledEnd, notes } = data;

  // Verify BOM belongs to tenant and is active
  const bom = await prisma.bom.findFirst({
    where: { id: bomId, tenantId },
    include: { bomLines: true },
  });
  if (!bom) throw notFoundError('BOM not found');
  if (bom.status !== 'active') {
    throw new AppError(400, 'INVALID_BOM', 'Only active BOMs can be used for work orders');
  }

  const woNumber = await generateWONumber(tenantId);

  return prisma.$transaction(async (tx) => {
    const wo = await tx.workOrder.create({
      data: {
        tenantId,
        woNumber,
        bomId,
        quantity,
        status: 'planned',
        priority: priority ?? 0,
        scheduledStart: scheduledStart || null,
        scheduledEnd: scheduledEnd || null,
        notes: notes || null,
        createdBy: userId,
        lines: {
          create: bom.bomLines.map((bl) => ({
            itemId: bl.itemId,
            // quantityRequired = BOM line qty x WO qty x (1 + scrapFactor)
            quantityRequired: Number(bl.quantity) * quantity * (1 + Number(bl.scrapFactor)),
          })),
        },
      },
      include: {
        bom: {
          select: {
            id: true,
            revision: true,
            item: { select: { id: true, partNumber: true, description: true } },
          },
        },
        lines: {
          include: {
            item: { select: { id: true, partNumber: true, description: true, unitOfMeasure: true } },
          },
        },
      },
    });
    return wo;
  });
};

/** Update a planned WO. Only planned WOs can be edited. */
const update = async (id, data, tenantId) => {
  const existing = await prisma.workOrder.findFirst({ where: { id, tenantId } });
  if (!existing) throw notFoundError('Work order not found');
  if (existing.status !== 'planned') {
    throw new AppError(400, 'INVALID_STATUS', 'Only planned work orders can be edited');
  }

  const { quantity, priority, scheduledStart, scheduledEnd, notes } = data;

  // If quantity changed, recalculate material line requirements
  if (quantity && quantity !== Number(existing.quantity)) {
    const bom = await prisma.bom.findFirst({
      where: { id: existing.bomId },
      include: { bomLines: true },
    });

    return prisma.$transaction(async (tx) => {
      // Delete old lines and recreate with new quantities
      await tx.workOrderLine.deleteMany({ where: { workOrderId: id } });

      await tx.workOrderLine.createMany({
        data: bom.bomLines.map((bl) => ({
          workOrderId: id,
          itemId: bl.itemId,
          quantityRequired: Number(bl.quantity) * quantity * (1 + Number(bl.scrapFactor)),
        })),
      });

      const wo = await tx.workOrder.update({
        where: { id },
        data: {
          quantity,
          priority: priority !== undefined ? priority : undefined,
          scheduledStart: scheduledStart !== undefined ? (scheduledStart || null) : undefined,
          scheduledEnd: scheduledEnd !== undefined ? (scheduledEnd || null) : undefined,
          notes: notes !== undefined ? (notes || null) : undefined,
        },
        include: {
          bom: {
            select: {
              id: true,
              revision: true,
              item: { select: { id: true, partNumber: true, description: true } },
            },
          },
          lines: {
            include: {
              item: { select: { id: true, partNumber: true, description: true, unitOfMeasure: true } },
            },
          },
        },
      });
      return wo;
    });
  }

  // No quantity change — simple field update
  return prisma.workOrder.update({
    where: { id },
    data: {
      ...(priority !== undefined && { priority }),
      scheduledStart: scheduledStart !== undefined ? (scheduledStart || null) : undefined,
      scheduledEnd: scheduledEnd !== undefined ? (scheduledEnd || null) : undefined,
      notes: notes !== undefined ? (notes || null) : undefined,
    },
    include: {
      bom: {
        select: {
          id: true,
          revision: true,
          item: { select: { id: true, partNumber: true, description: true } },
        },
      },
      lines: {
        include: {
          item: { select: { id: true, partNumber: true, description: true, unitOfMeasure: true } },
        },
      },
    },
  });
};

/**
 * Change WO status. Validates transition rules.
 * On in_progress: sets actualStart.
 * On completed: sets actualEnd + creates inventory receipt for finished item.
 * On cancelled: warns if material has been issued.
 */
const changeStatus = async (id, newStatus, tenantId, userId) => {
  const wo = await prisma.workOrder.findFirst({
    where: { id, tenantId },
    include: {
      lines: true,
      bom: { include: { item: true } },
    },
  });
  if (!wo) throw notFoundError('Work order not found');

  // Validate transition
  const allowedTransitions = VALID_TRANSITIONS[wo.status];
  if (!allowedTransitions || !allowedTransitions.includes(newStatus)) {
    throw new AppError(400, 'INVALID_TRANSITION',
      `Cannot transition from '${wo.status}' to '${newStatus}'`
    );
  }

  // Check for issued material on cancel
  const totalIssued = wo.lines.reduce((sum, l) => sum + Number(l.quantityIssued), 0);
  if (newStatus === 'cancelled' && totalIssued > 0) {
    // Spec says "warning" — we'll include it in the response but still allow cancel
  }

  return prisma.$transaction(async (tx) => {
    const updateData = { status: newStatus };

    if (newStatus === 'in_progress') {
      updateData.actualStart = new Date();
    }

    if (newStatus === 'completed') {
      updateData.actualEnd = new Date();

      // Create inventory receipt for the finished item
      // The BOM's item is what gets produced
      const finishedItemId = wo.bom.itemId;

      // We need a location for the finished goods — use the first issue location,
      // or fall back to any active location in the tenant
      let receiptLocationId = null;
      const issuedLine = wo.lines.find((l) => l.locationId);
      if (issuedLine) {
        receiptLocationId = issuedLine.locationId;
      } else {
        const defaultLoc = await tx.inventoryLocation.findFirst({
          where: { tenantId, isActive: true },
        });
        if (defaultLoc) receiptLocationId = defaultLoc.id;
      }

      if (!receiptLocationId) {
        throw new AppError(400, 'NO_LOCATION', 'No location available for finished goods receipt');
      }

      // Create inventory transaction for the finished item
      await tx.inventoryTransaction.create({
        data: {
          tenantId,
          itemId: finishedItemId,
          locationId: receiptLocationId,
          transactionType: 'receipt',
          quantity: Number(wo.quantity),
          referenceType: 'work_order',
          referenceId: wo.id,
          performedBy: userId,
          performedAt: new Date(),
          notes: `WO ${wo.woNumber} completion — produced ${wo.quantity} units`,
        },
      });

      // Upsert stock for the finished item
      await upsertStock(tx, tenantId, {
        itemId: finishedItemId,
        locationId: receiptLocationId,
        lotNumber: null,
        serialNumber: null,
        quantityDelta: Number(wo.quantity),
      });
    }

    const updated = await tx.workOrder.update({
      where: { id },
      data: updateData,
    });

    return {
      workOrder: updated,
      ...(newStatus === 'cancelled' && totalIssued > 0 && {
        warning: `${totalIssued} units of material had already been issued`,
      }),
    };
  });
};

/**
 * Issue material from inventory against WO lines.
 * For each issue line:
 *  1. Validates the WO line and quantity
 *  2. Updates WOLine.quantityIssued
 *  3. Creates an InventoryTransaction (type: issue)
 *  4. Decrements InventoryStock
 */
const issueMaterial = async (woId, data, tenantId, userId) => {
  const wo = await prisma.workOrder.findFirst({
    where: { id: woId, tenantId },
    include: { lines: true },
  });
  if (!wo) throw notFoundError('Work order not found');
  if (!['released', 'in_progress'].includes(wo.status)) {
    throw new AppError(400, 'INVALID_STATUS', 'WO must be released or in-progress to issue material');
  }

  // Build line map for validation
  const lineMap = new Map(wo.lines.map((l) => [l.id, l]));

  // Validate all issue lines
  for (const il of data.lines) {
    const woLine = lineMap.get(il.woLineId);
    if (!woLine) {
      throw new AppError(400, 'VALIDATION_ERROR', `WO line ${il.woLineId} not found on this work order`);
    }
    const remaining = Number(woLine.quantityRequired) - Number(woLine.quantityIssued);
    if (il.quantity > remaining) {
      throw new AppError(400, 'VALIDATION_ERROR',
        `Cannot issue ${il.quantity} — only ${remaining} remaining on line`
      );
    }
  }

  // Verify all locations belong to tenant
  const locationIds = [...new Set(data.lines.map((l) => l.locationId))];
  const locations = await prisma.inventoryLocation.findMany({
    where: { id: { in: locationIds }, tenantId, isActive: true },
  });
  if (locations.length !== locationIds.length) {
    throw new AppError(400, 'VALIDATION_ERROR', 'One or more locations not found or inactive');
  }

  return prisma.$transaction(async (tx) => {
    const issued = [];

    for (const il of data.lines) {
      const woLine = lineMap.get(il.woLineId);

      // 1. Update WO line quantityIssued + locationId/lot/serial
      await tx.workOrderLine.update({
        where: { id: il.woLineId },
        data: {
          quantityIssued: Number(woLine.quantityIssued) + il.quantity,
          locationId: il.locationId,
          lotNumber: il.lotNumber || null,
          serialNumber: il.serialNumber || null,
        },
      });

      // 2. Create inventory transaction (issue type — negative quantity)
      await tx.inventoryTransaction.create({
        data: {
          tenantId,
          itemId: woLine.itemId,
          locationId: il.locationId,
          transactionType: 'issue',
          quantity: -il.quantity,
          lotNumber: il.lotNumber || null,
          serialNumber: il.serialNumber || null,
          referenceType: 'work_order',
          referenceId: woId,
          performedBy: userId,
          performedAt: new Date(),
          notes: `WO ${wo.woNumber} material issue`,
        },
      });

      // 3. Decrement inventory stock
      await upsertStock(tx, tenantId, {
        itemId: woLine.itemId,
        locationId: il.locationId,
        lotNumber: il.lotNumber,
        serialNumber: il.serialNumber,
        quantityDelta: -il.quantity,
      });

      issued.push({ woLineId: il.woLineId, quantity: il.quantity });
    }

    return { issued };
  });
};

module.exports = { list, getById, create, update, changeStatus, issueMaterial };
