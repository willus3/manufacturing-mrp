const { prisma } = require('../db');

// ============================================
// GET DASHBOARD SUMMARY
// All queries run in parallel for speed.
// Returns counts and alerts for the dashboard cards.
// ============================================
const getDashboardSummary = async (tenantId) => {
  const now = new Date();

  const [
    lowStockItems,
    posByStatus,
    overduePOs,
    wosByStatus,
    openDemandCount,
    lastMrpRun,
  ] = await Promise.all([
    // 1. Low stock alerts — items where available stock < reorderPoint
    getLowStockAlerts(tenantId),

    // 2. POs grouped by status
    prisma.purchaseOrder.groupBy({
      by: ['status'],
      _count: true,
      where: { tenantId },
    }),

    // 3. Overdue POs — sent or partial, past expected date
    prisma.purchaseOrder.count({
      where: {
        tenantId,
        status: { in: ['sent', 'partial'] },
        expectedDate: { lt: now },
      },
    }),

    // 4. Work orders grouped by status
    prisma.workOrder.groupBy({
      by: ['status'],
      _count: true,
      where: { tenantId },
    }),

    // 5. Open demand entries
    prisma.demandEntry.count({
      where: { tenantId, status: 'open' },
    }),

    // 6. Last MRP run
    prisma.mrpRun.findFirst({
      where: { tenantId },
      orderBy: { ranAt: 'desc' },
    }),
  ]);

  // Count unconverted MRP suggestions from the last run
  let unconvertedSuggestions = 0;
  if (lastMrpRun) {
    unconvertedSuggestions = await prisma.mrpResult.count({
      where: { mrpRunId: lastMrpRun.id, status: 'suggested' },
    });
  }

  // Format PO counts into a keyed object
  const purchaseOrders = {
    draft: 0,
    sent: 0,
    partial: 0,
    received: 0,
    cancelled: 0,
    overdue: overduePOs,
  };
  for (const row of posByStatus) {
    purchaseOrders[row.status] = row._count;
  }

  // Format WO counts into a keyed object
  const workOrders = {
    planned: 0,
    released: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
  };
  for (const row of wosByStatus) {
    workOrders[row.status] = row._count;
  }

  return {
    lowStockAlerts: lowStockItems,
    purchaseOrders,
    workOrders,
    openDemand: openDemandCount,
    lastMrpRun: lastMrpRun
      ? {
          id: lastMrpRun.id,
          ranAt: lastMrpRun.ranAt,
          status: lastMrpRun.status,
          unconvertedSuggestions,
        }
      : null,
  };
};

// ============================================
// LOW STOCK ALERTS
// Two-step approach:
//   1. Get items with a reorderPoint set
//   2. Aggregate available stock per item and compare
// ============================================
const getLowStockAlerts = async (tenantId) => {
  // Get all items that have a reorderPoint defined
  const itemsWithReorderPoint = await prisma.item.findMany({
    where: {
      tenantId,
      isActive: true,
      reorderPoint: { not: null },
    },
    select: {
      id: true,
      partNumber: true,
      description: true,
      reorderPoint: true,
      unitOfMeasure: true,
    },
  });

  if (itemsWithReorderPoint.length === 0) {
    return { count: 0, items: [] };
  }

  // Get stock aggregated by itemId for these items
  const stockAggs = await prisma.inventoryStock.groupBy({
    by: ['itemId'],
    _sum: { quantityOnHand: true },
    where: {
      tenantId,
      inventoryStatus: 'available',
      itemId: { in: itemsWithReorderPoint.map((i) => i.id) },
    },
  });

  // Build a lookup: itemId → total available qty
  const stockByItem = {};
  for (const agg of stockAggs) {
    stockByItem[agg.itemId] = Number(agg._sum.quantityOnHand || 0);
  }

  // Find items where available stock is below reorder point
  const lowStockList = itemsWithReorderPoint
    .map((item) => {
      const availableQty = stockByItem[item.id] || 0;
      const reorderPoint = Number(item.reorderPoint);
      return {
        id: item.id,
        partNumber: item.partNumber,
        description: item.description,
        unitOfMeasure: item.unitOfMeasure,
        availableQty,
        reorderPoint,
        shortfall: reorderPoint - availableQty,
      };
    })
    .filter((item) => item.availableQty < item.reorderPoint)
    .sort((a, b) => b.shortfall - a.shortfall); // Worst shortfalls first

  return {
    count: lowStockList.length,
    items: lowStockList.slice(0, 5), // Top 5 for the dashboard card
  };
};

module.exports = { getDashboardSummary };
