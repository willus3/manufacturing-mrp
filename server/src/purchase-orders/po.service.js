// Purchase Order service — business logic for PO lifecycle.
// Handles auto-numbering, CRUD, status transitions, and receiving
// (which creates inventory transactions via the same upsertStock pattern).

const { prisma } = require('../db');
const { AppError, notFoundError } = require('../utils/errors');

// ---------- Helpers ----------

/** Generate next PO number for a tenant (PO-0001, PO-0002, ...) */
const generatePONumber = async (tenantId) => {
  const last = await prisma.purchaseOrder.findFirst({
    where: { tenantId },
    orderBy: { poNumber: 'desc' },
    select: { poNumber: true },
  });

  if (!last) return 'PO-0001';

  // Extract numeric part and increment
  const num = parseInt(last.poNumber.replace('PO-', ''), 10);
  return `PO-${String(num + 1).padStart(4, '0')}`;
};

/** Derive PO status from line quantities. */
const derivePOStatus = (lines) => {
  const allReceived = lines.every(
    (l) => Number(l.quantityReceived) >= Number(l.quantityOrdered)
  );
  const someReceived = lines.some((l) => Number(l.quantityReceived) > 0);

  if (allReceived) return 'received';
  if (someReceived) return 'partial';
  return null; // no change needed
};

/**
 * Upsert stock — mirrors the inventory service pattern.
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
    return tx.inventoryStock.update({
      where: { id: existing.id },
      data: { quantityOnHand: newQty },
    });
  }

  return tx.inventoryStock.create({
    data: { tenantId, itemId, locationId, lotNumber: lot, serialNumber: serial, inventoryStatus: status, quantityOnHand: quantityDelta },
  });
};

// ---------- CRUD ----------

/** List POs with pagination and filters. */
const list = async (tenantId, query) => {
  const { page, pageSize, sort, order, status, supplierId } = query;
  const where = { tenantId };
  if (status) where.status = status;
  if (supplierId) where.supplierId = supplierId;

  const [data, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      orderBy: { [sort]: order },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        _count: { select: { lines: true } },
      },
    }),
    prisma.purchaseOrder.count({ where }),
  ]);

  return {
    purchaseOrders: data,
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
};

/** Get single PO with lines (including item details) and receipts. */
const getById = async (id, tenantId) => {
  const po = await prisma.purchaseOrder.findFirst({
    where: { id, tenantId },
    include: {
      supplier: { select: { id: true, name: true, code: true } },
      creator: { select: { id: true, firstName: true, lastName: true } },
      lines: {
        include: {
          item: { select: { id: true, partNumber: true, description: true, unitOfMeasure: true } },
          workOrder: { select: { id: true, woNumber: true } },
          receipts: {
            include: {
              location: { select: { id: true, code: true, name: true } },
              user: { select: { id: true, firstName: true, lastName: true } },
            },
            orderBy: { receivedAt: 'desc' },
          },
        },
      },
    },
  });

  if (!po) throw notFoundError('Purchase order not found');
  return po;
};

/** Create a new PO with lines. Auto-generates PO number. */
const create = async (data, tenantId, userId) => {
  const { supplierId, orderDate, expectedDate, notes, lines } = data;

  // Verify supplier belongs to tenant
  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, tenantId } });
  if (!supplier) throw notFoundError('Supplier not found');

  // Verify all items belong to tenant
  const itemIds = lines.map((l) => l.itemId);
  const items = await prisma.item.findMany({ where: { id: { in: itemIds }, tenantId } });
  if (items.length !== new Set(itemIds).size) {
    throw new AppError(400, 'VALIDATION_ERROR', 'One or more items not found');
  }

  const poNumber = await generatePONumber(tenantId);

  return prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.create({
      data: {
        tenantId,
        poNumber,
        supplierId,
        status: 'draft',
        orderDate: orderDate || null,
        expectedDate: expectedDate || null,
        notes: notes || null,
        createdBy: userId,
        lines: {
          create: lines.map((line) => ({
            itemId: line.itemId,
            workOrderId: line.workOrderId ?? null,
            quantityOrdered: line.quantityOrdered,
            unitCost: line.unitCost ?? null,
            dueDate: line.dueDate ?? null,
            notes: line.notes ?? null,
          })),
        },
      },
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        lines: {
          include: {
            item: { select: { id: true, partNumber: true, description: true, unitOfMeasure: true } },
            workOrder: { select: { id: true, woNumber: true } },
          },
        },
      },
    });
    return po;
  });
};

/** Update a draft PO. Replaces all lines if provided. */
const update = async (id, data, tenantId) => {
  const existing = await prisma.purchaseOrder.findFirst({ where: { id, tenantId } });
  if (!existing) throw notFoundError('Purchase order not found');
  if (existing.status !== 'draft') {
    throw new AppError(400, 'INVALID_STATUS', 'Only draft POs can be edited');
  }

  const { supplierId, orderDate, expectedDate, notes, lines } = data;

  // Verify supplier if changing
  if (supplierId && supplierId !== existing.supplierId) {
    const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, tenantId } });
    if (!supplier) throw notFoundError('Supplier not found');
  }

  return prisma.$transaction(async (tx) => {
    // If lines provided, replace all existing lines
    if (lines) {
      // Verify all items
      const itemIds = lines.map((l) => l.itemId);
      const items = await tx.item.findMany({ where: { id: { in: itemIds }, tenantId } });
      if (items.length !== new Set(itemIds).size) {
        throw new AppError(400, 'VALIDATION_ERROR', 'One or more items not found');
      }

      await tx.purchaseOrderLine.deleteMany({ where: { purchaseOrderId: id } });

      await tx.purchaseOrderLine.createMany({
        data: lines.map((line) => ({
          purchaseOrderId: id,
          itemId: line.itemId,
          workOrderId: line.workOrderId ?? null,
          quantityOrdered: line.quantityOrdered,
          unitCost: line.unitCost ?? null,
          dueDate: line.dueDate ?? null,
          notes: line.notes ?? null,
        })),
      });
    }

    const po = await tx.purchaseOrder.update({
      where: { id },
      data: {
        ...(supplierId && { supplierId }),
        orderDate: orderDate !== undefined ? (orderDate || null) : undefined,
        expectedDate: expectedDate !== undefined ? (expectedDate || null) : undefined,
        notes: notes !== undefined ? (notes || null) : undefined,
      },
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        lines: {
          include: {
            item: { select: { id: true, partNumber: true, description: true, unitOfMeasure: true } },
            workOrder: { select: { id: true, woNumber: true } },
          },
        },
      },
    });
    return po;
  });
};

/** Mark a draft PO as sent. */
const send = async (id, tenantId) => {
  const po = await prisma.purchaseOrder.findFirst({ where: { id, tenantId } });
  if (!po) throw notFoundError('Purchase order not found');
  if (po.status !== 'draft') {
    throw new AppError(400, 'INVALID_STATUS', 'Only draft POs can be sent');
  }

  return prisma.purchaseOrder.update({
    where: { id },
    data: { status: 'sent', orderDate: po.orderDate || new Date() },
  });
};

/** Cancel a PO (only draft or sent). */
const cancel = async (id, tenantId) => {
  const po = await prisma.purchaseOrder.findFirst({ where: { id, tenantId } });
  if (!po) throw notFoundError('Purchase order not found');
  if (!['draft', 'sent'].includes(po.status)) {
    throw new AppError(400, 'INVALID_STATUS', 'Only draft or sent POs can be cancelled');
  }

  return prisma.purchaseOrder.update({
    where: { id },
    data: { status: 'cancelled' },
  });
};

/**
 * Receive items against PO lines.
 * For each receive line:
 *  1. Validates the PO line and quantity
 *  2. Creates a PurchaseOrderReceipt
 *  3. Updates POLine.quantityReceived
 *  4. Creates an InventoryTransaction (type: receipt)
 *  5. Upserts InventoryStock
 * After all lines, derives PO status (partial or received).
 */
const receive = async (poId, data, tenantId, userId) => {
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, tenantId },
    include: { lines: true },
  });
  if (!po) throw notFoundError('Purchase order not found');
  if (!['sent', 'partial'].includes(po.status)) {
    throw new AppError(400, 'INVALID_STATUS', 'PO must be sent or partial to receive against');
  }

  // Build a map of PO lines by ID for quick lookup
  const lineMap = new Map(po.lines.map((l) => [l.id, l]));

  // Validate all receive lines before starting the transaction
  for (const rl of data.lines) {
    const poLine = lineMap.get(rl.poLineId);
    if (!poLine) {
      throw new AppError(400, 'VALIDATION_ERROR', `PO line ${rl.poLineId} not found on this PO`);
    }
    const remaining = Number(poLine.quantityOrdered) - Number(poLine.quantityReceived);
    if (rl.quantity > remaining) {
      throw new AppError(400, 'VALIDATION_ERROR',
        `Cannot receive ${rl.quantity} — only ${remaining} remaining on line for item`
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
    const receipts = [];

    for (const rl of data.lines) {
      const poLine = lineMap.get(rl.poLineId);

      // 1. Create receipt record
      const receipt = await tx.purchaseOrderReceipt.create({
        data: {
          tenantId,
          poLineId: rl.poLineId,
          quantityReceived: rl.quantity,
          locationId: rl.locationId,
          lotNumber: rl.lotNumber || null,
          serialNumber: rl.serialNumber || null,
          receivedBy: userId,
          receivedAt: new Date(),
          notes: rl.notes || null,
        },
      });
      receipts.push(receipt);

      // 2. Update PO line quantityReceived
      await tx.purchaseOrderLine.update({
        where: { id: rl.poLineId },
        data: { quantityReceived: Number(poLine.quantityReceived) + rl.quantity },
      });

      // 3. Create inventory transaction (receipt type)
      await tx.inventoryTransaction.create({
        data: {
          tenantId,
          itemId: poLine.itemId,
          locationId: rl.locationId,
          transactionType: 'receipt',
          quantity: rl.quantity,
          lotNumber: rl.lotNumber || null,
          serialNumber: rl.serialNumber || null,
          referenceType: 'purchase_order',
          referenceId: poId,
          performedBy: userId,
          performedAt: new Date(),
          notes: `PO ${po.poNumber} receipt`,
        },
      });

      // 4. Upsert inventory stock
      await upsertStock(tx, tenantId, {
        itemId: poLine.itemId,
        locationId: rl.locationId,
        lotNumber: rl.lotNumber,
        serialNumber: rl.serialNumber,
        quantityDelta: rl.quantity,
      });
    }

    // 5. Derive new PO status from updated line quantities
    const updatedLines = await tx.purchaseOrderLine.findMany({
      where: { purchaseOrderId: poId },
    });
    const newStatus = derivePOStatus(updatedLines);
    if (newStatus) {
      await tx.purchaseOrder.update({
        where: { id: poId },
        data: { status: newStatus },
      });
    }

    return { receipts, newStatus: newStatus || po.status };
  });
};

module.exports = { list, getById, create, update, send, cancel, receive };
