// MRP service — business logic for demand management and the MRP calculation engine.
//
// Demand: manual input of what needs to be produced (finished goods / sub-assemblies).
// MRP Run: explodes BOMs, nets against stock + open POs/WOs, generates suggestions.
// Results: convert suggestions into real POs or WOs, or dismiss them.

const { prisma } = require('../db');
const { AppError, notFoundError } = require('../utils/errors');

// ============================================
// Demand CRUD
// ============================================

/** List demand entries — paginated with status/item filters. */
const listDemand = async (tenantId, query) => {
  const { page, pageSize, status, itemId } = query;
  const where = { tenantId };
  if (status) where.status = status;
  if (itemId) where.itemId = itemId;

  const [total, data] = await Promise.all([
    prisma.demandEntry.count({ where }),
    prisma.demandEntry.findMany({
      where,
      include: {
        item: { select: { id: true, partNumber: true, description: true, type: true } },
        creator: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { dateRequired: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    demand: data,
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
};

/** Get a single demand entry by ID. */
const getDemand = async (id, tenantId) => {
  const entry = await prisma.demandEntry.findFirst({
    where: { id, tenantId },
    include: {
      item: { select: { id: true, partNumber: true, description: true, type: true } },
      creator: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!entry) throw notFoundError('Demand entry not found');
  return entry;
};

/** Create a new demand entry. Item must be finished_good or sub_assembly. */
const createDemand = async (data, tenantId, userId) => {
  const { itemId, quantityRequired, dateRequired, notes } = data;

  // Verify item belongs to tenant and is a producible type
  const item = await prisma.item.findFirst({
    where: { id: itemId, tenantId },
    select: { id: true, type: true, partNumber: true },
  });
  if (!item) throw notFoundError('Item not found');
  if (!['finished_good', 'sub_assembly'].includes(item.type)) {
    throw new AppError(400, 'VALIDATION_ERROR',
      `Demand can only be created for finished goods or sub-assemblies. "${item.partNumber}" is a ${item.type}.`
    );
  }

  return prisma.demandEntry.create({
    data: {
      tenantId,
      itemId,
      quantityRequired,
      dateRequired,
      source: 'manual',
      status: 'open',
      notes: notes || null,
      createdBy: userId,
    },
    include: {
      item: { select: { id: true, partNumber: true, description: true, type: true } },
      creator: { select: { id: true, firstName: true, lastName: true } },
    },
  });
};

/** Update an open demand entry. Only open entries can be edited. */
const updateDemand = async (id, data, tenantId) => {
  const existing = await prisma.demandEntry.findFirst({ where: { id, tenantId } });
  if (!existing) throw notFoundError('Demand entry not found');
  if (existing.status !== 'open') {
    throw new AppError(400, 'INVALID_STATUS', 'Only open demand entries can be edited');
  }

  const { quantityRequired, dateRequired, notes } = data;

  return prisma.demandEntry.update({
    where: { id },
    data: {
      ...(quantityRequired !== undefined && { quantityRequired }),
      ...(dateRequired !== undefined && { dateRequired }),
      ...(notes !== undefined && { notes: notes || null }),
    },
    include: {
      item: { select: { id: true, partNumber: true, description: true, type: true } },
      creator: { select: { id: true, firstName: true, lastName: true } },
    },
  });
};

/** Cancel a demand entry. */
const cancelDemand = async (id, tenantId) => {
  const existing = await prisma.demandEntry.findFirst({ where: { id, tenantId } });
  if (!existing) throw notFoundError('Demand entry not found');
  if (existing.status === 'cancelled') {
    throw new AppError(400, 'INVALID_STATUS', 'Demand is already cancelled');
  }
  if (existing.status === 'fulfilled') {
    throw new AppError(400, 'INVALID_STATUS', 'Cannot cancel a fulfilled demand');
  }

  return prisma.demandEntry.update({
    where: { id },
    data: { status: 'cancelled' },
    include: {
      item: { select: { id: true, partNumber: true, description: true, type: true } },
    },
  });
};

// ============================================
// MRP Engine
// ============================================

/**
 * Run the MRP calculation.
 *
 * Algorithm:
 * 1. Gather all open demand entries within the planning horizon
 * 2. For each demand, explode the BOM recursively to get gross requirements
 * 3. Net requirements = gross - available stock - open PO qty - open WO qty
 * 4. For net > 0:
 *    - Raw materials / purchased components → purchase suggestion (with preferred supplier)
 *    - Sub-assemblies / finished goods → produce suggestion
 * 5. Offset dates by lead time to get suggested order date
 * 6. All results are suggestions — planner reviews and converts
 */
const runMrp = async (tenantId, userId, params) => {
  const { planningHorizonDays } = params;

  // Calculate horizon end date
  const horizonEnd = new Date();
  horizonEnd.setDate(horizonEnd.getDate() + planningHorizonDays);

  // 1. Gather open demand
  const openDemand = await prisma.demandEntry.findMany({
    where: {
      tenantId,
      status: 'open',
      dateRequired: { lte: horizonEnd },
    },
    include: {
      item: { select: { id: true, partNumber: true, type: true, leadTimeDays: true } },
    },
    orderBy: { dateRequired: 'asc' },
  });

  if (openDemand.length === 0) {
    throw new AppError(400, 'NO_DEMAND', 'No open demand entries found within the planning horizon');
  }

  // Create the MRP run record
  const mrpRun = await prisma.mrpRun.create({
    data: {
      tenantId,
      status: 'running',
      ranBy: userId,
      ranAt: new Date(),
      parameters: { planningHorizonDays },
    },
  });

  try {
    // 2. Explode BOMs and accumulate gross requirements
    // Key: itemId, Value: { grossQty, dateNeeded (earliest) }
    const grossRequirements = new Map();

    for (const demand of openDemand) {
      await explodeBom(
        tenantId,
        demand.itemId,
        Number(demand.quantityRequired),
        new Date(demand.dateRequired),
        grossRequirements
      );
    }

    // 3. Net requirements: gross - available stock - open PO/WO quantities
    const results = [];

    for (const [itemId, requirement] of grossRequirements) {
      const { grossQty, dateNeeded } = requirement;

      // Get available stock
      const stockAgg = await prisma.inventoryStock.aggregate({
        where: { tenantId, itemId, inventoryStatus: 'available' },
        _sum: { quantityOnHand: true },
      });
      const availableStock = Number(stockAgg._sum.quantityOnHand || 0);

      // Get open PO quantities (draft + sent + partial)
      const poAgg = await prisma.purchaseOrderLine.aggregate({
        where: {
          item: { id: itemId },
          purchaseOrder: {
            tenantId,
            status: { in: ['draft', 'sent', 'partial'] },
          },
        },
        _sum: { quantityOrdered: true },
      });
      // Subtract already received from open PO qty
      const poReceivedAgg = await prisma.purchaseOrderLine.aggregate({
        where: {
          item: { id: itemId },
          purchaseOrder: {
            tenantId,
            status: { in: ['draft', 'sent', 'partial'] },
          },
        },
        _sum: { quantityReceived: true },
      });
      const openPoQty = Number(poAgg._sum.quantityOrdered || 0) - Number(poReceivedAgg._sum.quantityReceived || 0);

      // Get open WO quantities (planned + released + in_progress)
      const woAgg = await prisma.workOrder.aggregate({
        where: {
          tenantId,
          bom: { itemId },
          status: { in: ['planned', 'released', 'in_progress'] },
        },
        _sum: { quantity: true },
      });
      const openWoQty = Number(woAgg._sum.quantity || 0);

      // Net requirement (rounded to avoid floating point noise)
      const netQty = Math.round((grossQty - availableStock - openPoQty - openWoQty) * 100) / 100;

      if (netQty <= 0) continue; // Sufficient supply, no action needed

      // 4. Determine action type based on item type
      const item = await prisma.item.findUnique({
        where: { id: itemId },
        select: { id: true, type: true, leadTimeDays: true },
      });

      const isPurchase = ['raw_material', 'purchased_component', 'consumable'].includes(item.type);
      const actionType = isPurchase ? 'purchase' : 'produce';

      // 5. Offset by lead time
      const leadTime = item.leadTimeDays || 0;
      const suggestedOrderDate = new Date(dateNeeded);
      suggestedOrderDate.setDate(suggestedOrderDate.getDate() - leadTime);

      // Find preferred supplier for purchase items
      let supplierId = null;
      if (isPurchase) {
        const preferred = await prisma.itemSupplier.findFirst({
          where: { itemId, isPreferred: true },
          select: { supplierId: true },
        });
        if (preferred) supplierId = preferred.supplierId;
      }

      results.push({
        mrpRunId: mrpRun.id,
        itemId,
        actionType,
        quantityNeeded: netQty,
        dateNeeded,
        suggestedOrderDate,
        supplierId,
        status: 'suggested',
      });
    }

    // Save all results
    if (results.length > 0) {
      await prisma.mrpResult.createMany({ data: results });
    }

    // Mark demand entries as planned
    await prisma.demandEntry.updateMany({
      where: {
        tenantId,
        status: 'open',
        dateRequired: { lte: horizonEnd },
      },
      data: { status: 'planned' },
    });

    // Mark run as completed
    const completedRun = await prisma.mrpRun.update({
      where: { id: mrpRun.id },
      data: { status: 'completed', completedAt: new Date() },
      include: {
        results: {
          include: {
            item: { select: { id: true, partNumber: true, description: true, type: true } },
            supplier: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    return completedRun;
  } catch (err) {
    // Mark run as failed on error
    await prisma.mrpRun.update({
      where: { id: mrpRun.id },
      data: { status: 'failed' },
    });
    throw err;
  }
};

/**
 * Recursively explode a BOM to accumulate gross requirements for all components.
 * Handles multi-level BOMs and scrap factors.
 *
 * @param {string} tenantId
 * @param {string} itemId - The item to explode
 * @param {number} parentQty - How many of this item are needed
 * @param {Date} dateNeeded - When this item is needed
 * @param {Map} requirements - Accumulated gross requirements (mutated)
 * @param {Set} visited - Circular reference detection
 */
const explodeBom = async (tenantId, itemId, parentQty, dateNeeded, requirements, visited = new Set()) => {
  if (visited.has(itemId)) return; // Skip circular refs

  // Find active BOM for this item
  const bom = await prisma.bom.findFirst({
    where: { itemId, tenantId, status: 'active' },
    include: { bomLines: true },
  });

  if (!bom) {
    // No BOM = leaf item (raw material, purchased component, etc.)
    // Add to requirements
    addRequirement(requirements, itemId, parentQty, dateNeeded);
    return;
  }

  // This item has a BOM — it's a producible item (sub-assembly or finished good).
  // Add it to requirements so the netting step can generate a "produce" suggestion.
  addRequirement(requirements, itemId, parentQty, dateNeeded);

  // Also explode its children to capture raw material requirements
  const nextVisited = new Set(visited);
  nextVisited.add(itemId);

  for (const line of bom.bomLines) {
    // Component qty = BOM line qty × parent qty × (1 + scrapFactor), rounded to avoid floating point noise
    const componentQty = Math.round(Number(line.quantity) * parentQty * (1 + Number(line.scrapFactor || 0)) * 100) / 100;

    // Recurse into sub-components
    await explodeBom(tenantId, line.itemId, componentQty, dateNeeded, requirements, nextVisited);
  }
};

/** Add or accumulate a gross requirement for an item. Keeps earliest dateNeeded. */
const addRequirement = (requirements, itemId, qty, dateNeeded) => {
  const existing = requirements.get(itemId);
  if (existing) {
    existing.grossQty += qty;
    if (dateNeeded < existing.dateNeeded) {
      existing.dateNeeded = dateNeeded;
    }
  } else {
    requirements.set(itemId, { grossQty: qty, dateNeeded });
  }
};

// ============================================
// MRP Run History & Results
// ============================================

/** List MRP runs — paginated. */
const listRuns = async (tenantId, query) => {
  const { page, pageSize } = query;
  const where = { tenantId };

  const [total, data] = await Promise.all([
    prisma.mrpRun.count({ where }),
    prisma.mrpRun.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { results: true } },
      },
      orderBy: { ranAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    runs: data,
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
};

/** Get results for a specific MRP run — filterable by actionType and status. */
const getRunResults = async (runId, tenantId, query) => {
  const run = await prisma.mrpRun.findFirst({ where: { id: runId, tenantId } });
  if (!run) throw notFoundError('MRP run not found');

  const where = { mrpRunId: runId };
  if (query.actionType) where.actionType = query.actionType;
  if (query.status) where.status = query.status;

  const results = await prisma.mrpResult.findMany({
    where,
    include: {
      item: { select: { id: true, partNumber: true, description: true, type: true, unitOfMeasure: true } },
      supplier: { select: { id: true, name: true, code: true } },
    },
    orderBy: [{ actionType: 'asc' }, { dateNeeded: 'asc' }],
  });

  return { run, results };
};

/**
 * Convert an MRP result into a real PO or WO.
 * - purchase → creates a draft PO with one line
 * - produce → creates a planned WO from the item's active BOM
 */
const convertResult = async (runId, resultId, tenantId, userId) => {
  const result = await prisma.mrpResult.findFirst({
    where: { id: resultId, mrpRunId: runId },
    include: {
      mrpRun: { select: { tenantId: true } },
      item: { select: { id: true, type: true, partNumber: true } },
    },
  });
  if (!result) throw notFoundError('MRP result not found');
  if (result.mrpRun.tenantId !== tenantId) throw notFoundError('MRP result not found');
  if (result.status !== 'suggested') {
    throw new AppError(400, 'INVALID_STATUS', `Result is already ${result.status}`);
  }

  if (result.actionType === 'purchase') {
    return convertToPO(result, tenantId, userId);
  } else {
    return convertToWO(result, tenantId, userId);
  }
};

/** Convert a purchase suggestion into a draft PO. */
const convertToPO = async (result, tenantId, userId) => {
  // Need a supplier — use the suggested one, or find any preferred supplier
  let supplierId = result.supplierId;
  if (!supplierId) {
    const preferred = await prisma.itemSupplier.findFirst({
      where: { itemId: result.itemId, isPreferred: true },
      select: { supplierId: true },
    });
    if (preferred) supplierId = preferred.supplierId;
  }
  if (!supplierId) {
    // Fall back to any linked supplier
    const any = await prisma.itemSupplier.findFirst({
      where: { itemId: result.itemId },
      select: { supplierId: true },
    });
    if (any) supplierId = any.supplierId;
  }
  if (!supplierId) {
    throw new AppError(400, 'NO_SUPPLIER', `No supplier linked to item "${result.item.partNumber}". Link a supplier first.`);
  }

  // Generate PO number
  const last = await prisma.purchaseOrder.findFirst({
    where: { tenantId },
    orderBy: { poNumber: 'desc' },
    select: { poNumber: true },
  });
  const nextNum = last ? parseInt(last.poNumber.replace('PO-', ''), 10) + 1 : 1;
  const poNumber = `PO-${String(nextNum).padStart(4, '0')}`;

  // Get unit cost from item-supplier link
  const itemSupplier = await prisma.itemSupplier.findFirst({
    where: { itemId: result.itemId, supplierId },
    select: { unitCost: true },
  });

  return prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.create({
      data: {
        tenantId,
        poNumber,
        supplierId,
        status: 'draft',
        expectedDate: result.dateNeeded,
        notes: `Auto-generated from MRP run`,
        createdBy: userId,
        lines: {
          create: [{
            itemId: result.itemId,
            quantityOrdered: result.quantityNeeded,
            unitCost: itemSupplier?.unitCost ?? null,
            dueDate: result.dateNeeded,
          }],
        },
      },
      include: {
        supplier: { select: { id: true, name: true } },
        lines: { include: { item: { select: { id: true, partNumber: true, description: true } } } },
      },
    });

    // Mark result as converted
    await tx.mrpResult.update({
      where: { id: result.id },
      data: { status: 'converted', convertedToId: po.id, convertedToType: 'purchase_order' },
    });

    return { type: 'purchase_order', po };
  });
};

/** Convert a produce suggestion into a planned WO. */
const convertToWO = async (result, tenantId, userId) => {
  // Find active BOM for the item
  const bom = await prisma.bom.findFirst({
    where: { itemId: result.itemId, tenantId, status: 'active' },
    include: { bomLines: true },
  });
  if (!bom) {
    throw new AppError(400, 'NO_BOM', `No active BOM found for item "${result.item.partNumber}". Create and activate a BOM first.`);
  }

  // Generate WO number
  const last = await prisma.workOrder.findFirst({
    where: { tenantId },
    orderBy: { woNumber: 'desc' },
    select: { woNumber: true },
  });
  const nextNum = last ? parseInt(last.woNumber.replace('WO-', ''), 10) + 1 : 1;
  const woNumber = `WO-${String(nextNum).padStart(4, '0')}`;

  const quantity = Number(result.quantityNeeded);

  return prisma.$transaction(async (tx) => {
    const wo = await tx.workOrder.create({
      data: {
        tenantId,
        woNumber,
        bomId: bom.id,
        quantity,
        status: 'planned',
        priority: 0,
        scheduledStart: result.suggestedOrderDate,
        scheduledEnd: result.dateNeeded,
        notes: `Auto-generated from MRP run`,
        createdBy: userId,
        lines: {
          create: bom.bomLines.map((bl) => ({
            itemId: bl.itemId,
            quantityRequired: Number(bl.quantity) * quantity * (1 + Number(bl.scrapFactor || 0)),
          })),
        },
      },
      include: {
        bom: {
          select: {
            id: true, revision: true,
            item: { select: { id: true, partNumber: true, description: true } },
          },
        },
        lines: {
          include: { item: { select: { id: true, partNumber: true, description: true } } },
        },
      },
    });

    // Mark result as converted
    await tx.mrpResult.update({
      where: { id: result.id },
      data: { status: 'converted', convertedToId: wo.id, convertedToType: 'work_order' },
    });

    return { type: 'work_order', wo };
  });
};

/** Dismiss an MRP result. */
const dismissResult = async (runId, resultId, tenantId) => {
  const result = await prisma.mrpResult.findFirst({
    where: { id: resultId, mrpRunId: runId },
    include: { mrpRun: { select: { tenantId: true } } },
  });
  if (!result) throw notFoundError('MRP result not found');
  if (result.mrpRun.tenantId !== tenantId) throw notFoundError('MRP result not found');
  if (result.status !== 'suggested') {
    throw new AppError(400, 'INVALID_STATUS', `Result is already ${result.status}`);
  }

  return prisma.mrpResult.update({
    where: { id: resultId },
    data: { status: 'dismissed' },
  });
};

module.exports = {
  listDemand,
  getDemand,
  createDemand,
  updateDemand,
  cancelDemand,
  runMrp,
  listRuns,
  getRunResults,
  convertResult,
  dismissResult,
};
