# V2: PO Consolidation & PO-WO Linking

## Problem

V1's MRP engine creates **one PO per purchase suggestion**. If an MRP run produces three purchase suggestions for the same supplier (e.g., oak lumber, screws, and stain from Acme Supply), the planner must convert each individually and gets three separate draft POs. Real manufacturing planners consolidate these into a single PO to reduce paperwork, shipping costs, and supplier confusion.

Additionally, there is no link between purchase orders and the work orders they supply materials for. When a WO needs raw materials that trigger purchase suggestions, the planner has no visibility into which PO lines feed which WOs. This makes it difficult to prioritize receiving and to understand the impact of a late delivery.

## Solution

Two changes, implemented in order:

### Part 1: Bulk PO Conversion (consolidation by supplier)

Add a new endpoint that accepts multiple purchase suggestion result IDs and groups them by supplier into consolidated POs. Each PO gets multiple lines (one per suggestion) instead of the current one-PO-per-suggestion pattern.

**New endpoint:** `POST /mrp/runs/:id/results/convert-bulk`

**Request body:**
```json
{
  "resultIds": ["uuid-1", "uuid-2", "uuid-3"]
}
```

**Behavior:**
1. Validate all result IDs belong to the run and have status `suggested` and actionType `purchase`
2. Resolve suppliers for each result (same logic as existing `convertToPO`)
3. Group results by `supplierId`
4. For each supplier group, create **one** draft PO with multiple lines
5. Mark all converted results as `converted` with `convertedToId` pointing to their PO
6. Return the created POs

**Response:**
```json
{
  "purchaseOrders": [
    {
      "poNumber": "PO-0005",
      "supplier": { "id": "...", "name": "Acme Supply" },
      "lines": [
        { "item": { "partNumber": "OAK-001" }, "quantityOrdered": 50, "dueDate": "2026-04-15" },
        { "item": { "partNumber": "SCR-010" }, "quantityOrdered": 200, "dueDate": "2026-04-12" }
      ]
    }
  ],
  "converted": 3,
  "purchaseOrdersCreated": 1
}
```

The existing single-convert endpoint (`POST /mrp/runs/:id/results/:resultId/convert`) remains unchanged for one-off conversions and WO conversion.

### Part 2: PO-WO Linking (traceability)

Add an optional `workOrderId` field to `PurchaseOrderLine`. When MRP creates purchase suggestions that originate from a produce requirement's BOM explosion, the MRP result already carries enough context to identify the demand chain. However, V1's MRP engine flattens requirements by item (merging quantities from multiple demands), so per-WO linking is not feasible without restructuring the engine.

**Pragmatic V2 approach:** Allow manual linking at the PO line level. Add a `workOrderId` column to `PurchaseOrderLine` and expose it in the PO edit UI as an optional "For WO" selector. This gives planners a way to note which WO a PO line is intended to supply, without requiring the MRP engine to track per-WO demand chains.

Automated linking (where MRP populates `workOrderId` during conversion) is deferred to V3, which would require the MRP engine to track demand provenance per-WO instead of flattening by item.

## Files to modify

### Part 1: Bulk PO Conversion

#### `server/src/mrp/mrp.validation.js`

Add a schema for the bulk convert request:
```js
const bulkConvertSchema = z.object({
  resultIds: z.array(z.string().uuid()).min(1, 'At least one result ID required').max(100),
});
```

Export it alongside existing schemas.

#### `server/src/mrp/mrp.service.js`

**New function: `convertBulkToPO()`** (~60 lines)

```js
const convertBulkToPO = async (runId, resultIds, tenantId, userId) => {
  // 1. Fetch all results, validate they belong to this run/tenant
  const results = await prisma.mrpResult.findMany({
    where: { id: { in: resultIds }, mrpRunId: runId },
    include: {
      mrpRun: { select: { tenantId: true } },
      item: { select: { id: true, type: true, partNumber: true } },
    },
  });

  // Validate: all found, all belong to tenant, all suggested, all purchase type
  if (results.length !== resultIds.length) {
    throw new AppError(400, 'VALIDATION_ERROR', 'One or more result IDs not found in this run');
  }
  for (const r of results) {
    if (r.mrpRun.tenantId !== tenantId) throw notFoundError('MRP result not found');
    if (r.status !== 'suggested') {
      throw new AppError(400, 'INVALID_STATUS', `Result for ${r.item.partNumber} is already ${r.status}`);
    }
    if (r.actionType !== 'purchase') {
      throw new AppError(400, 'VALIDATION_ERROR', `Result for ${r.item.partNumber} is a produce suggestion — use single convert`);
    }
  }

  // 2. Resolve supplier for each result (reuse existing logic)
  const resultWithSupplier = [];
  for (const r of results) {
    let supplierId = r.supplierId;
    if (!supplierId) {
      const preferred = await prisma.itemSupplier.findFirst({
        where: { itemId: r.itemId, isPreferred: true },
        select: { supplierId: true },
      });
      if (preferred) supplierId = preferred.supplierId;
    }
    if (!supplierId) {
      const any = await prisma.itemSupplier.findFirst({
        where: { itemId: r.itemId },
        select: { supplierId: true },
      });
      if (any) supplierId = any.supplierId;
    }
    if (!supplierId) {
      throw new AppError(400, 'NO_SUPPLIER', `No supplier linked to item "${r.item.partNumber}"`);
    }
    resultWithSupplier.push({ ...r, resolvedSupplierId: supplierId });
  }

  // 3. Group by supplier
  const bySupplier = new Map();
  for (const r of resultWithSupplier) {
    const key = r.resolvedSupplierId;
    if (!bySupplier.has(key)) bySupplier.set(key, []);
    bySupplier.get(key).push(r);
  }

  // 4. Create one PO per supplier group inside a transaction
  return prisma.$transaction(async (tx) => {
    const purchaseOrders = [];

    for (const [supplierId, groupResults] of bySupplier) {
      // Generate PO number (must be inside tx to avoid collisions)
      const last = await tx.purchaseOrder.findFirst({
        where: { tenantId },
        orderBy: { poNumber: 'desc' },
        select: { poNumber: true },
      });
      const nextNum = last ? parseInt(last.poNumber.replace('PO-', ''), 10) + 1 : 1;
      const poNumber = `PO-${String(nextNum).padStart(4, '0')}`;

      // Build lines — one per result
      const lineData = [];
      for (const r of groupResults) {
        const itemSupplier = await tx.itemSupplier.findFirst({
          where: { itemId: r.itemId, supplierId },
          select: { unitCost: true },
        });
        lineData.push({
          itemId: r.itemId,
          quantityOrdered: r.quantityNeeded,
          unitCost: itemSupplier?.unitCost ?? null,
          dueDate: r.dateNeeded,
        });
      }

      // Use earliest dateNeeded as PO expectedDate
      const earliestDate = groupResults.reduce(
        (min, r) => (r.dateNeeded < min ? r.dateNeeded : min),
        groupResults[0].dateNeeded
      );

      const po = await tx.purchaseOrder.create({
        data: {
          tenantId,
          poNumber,
          supplierId,
          status: 'draft',
          expectedDate: earliestDate,
          notes: `Auto-generated from MRP run (${groupResults.length} items)`,
          createdBy: userId,
          lines: { create: lineData },
        },
        include: {
          supplier: { select: { id: true, name: true, code: true } },
          lines: {
            include: { item: { select: { id: true, partNumber: true, description: true } } },
          },
        },
      });

      // Mark all results in this group as converted
      for (const r of groupResults) {
        await tx.mrpResult.update({
          where: { id: r.id },
          data: { status: 'converted', convertedToId: po.id, convertedToType: 'purchase_order' },
        });
      }

      purchaseOrders.push(po);
    }

    return {
      purchaseOrders,
      converted: resultIds.length,
      purchaseOrdersCreated: purchaseOrders.length,
    };
  });
};
```

Export alongside existing functions.

#### `server/src/mrp/mrp.controller.js`

**New handler: `convertBulkResults`**

```js
const convertBulkResults = async (req, res, next) => {
  try {
    const { resultIds } = bulkConvertSchema.parse(req.body);
    const result = await mrpService.convertBulkToPO(
      req.params.id, resultIds, req.tenantId, req.user.userId
    );
    sendSuccess(res, result, null, 201);
  } catch (err) {
    next(err);
  }
};
```

#### `server/src/mrp/mrp.routes.js`

Add before the single-result routes:
```js
router.post('/runs/:id/results/convert-bulk', mrpController.convertBulkResults);
```

**Important:** This must come before `'/runs/:id/results/:resultId/convert'` so Express doesn't match `convert-bulk` as a `:resultId` parameter.

#### `client/src/pages/mrp/MRPResultsPage.jsx`

Add bulk conversion UI to the purchase results section:

1. Add `selectedResults` state — `useState(new Set())`
2. Add a checkbox column to each purchase suggestion row (only when status === 'suggested')
3. Add a "Select All Suggested" checkbox in the purchase table header
4. Add a "Create POs ({n} selected)" button above the purchase results table, visible when `selectedResults.size > 0`
5. Add a `bulkConvertMutation` that calls `POST /mrp/runs/${runId}/results/convert-bulk` with the selected IDs
6. On success, show toast: `Created {n} PO(s) from {m} suggestions` and clear selection
7. Keep the existing per-row "Create PO" button as a fallback for one-off conversions

### Part 2: PO-WO Linking

#### `server/prisma/schema.prisma`

Add optional `workOrderId` to `PurchaseOrderLine`:
```prisma
model PurchaseOrderLine {
  // ... existing fields ...
  workOrderId      String?

  // Relations
  workOrder     WorkOrder?           @relation(fields: [workOrderId], references: [id])
  // ... existing relations ...
}
```

Add reverse relation to `WorkOrder`:
```prisma
model WorkOrder {
  // ... existing fields ...
  purchaseOrderLines PurchaseOrderLine[]
}
```

Run `npx prisma migrate dev --name add-po-wo-link`.

#### `server/src/purchase-orders/po.validation.js`

Add optional `workOrderId` (uuid, nullable) to the PO line schemas in both create and update.

#### `server/src/purchase-orders/po.service.js`

In `create` and `update`, pass `workOrderId` through to PO line creation. In `getById`, include work order info in the line response:
```js
lines: {
  include: {
    item: { ... },
    workOrder: { select: { id: true, woNumber: true } },  // add this
    receipts: { ... },
  },
},
```

#### `client/src/pages/purchase-orders/POFormPage.jsx`

In the PO line editor, add an optional "For WO" dropdown:
- Only shown on draft POs
- Fetches open work orders (`planned`, `released`, `in_progress`) from the tenant
- Displays as `WO-0001 — Item Description` format
- Selecting a WO sets `workOrderId` on the PO line
- Value is `null` when "None" is selected (default)

Display the linked WO (if any) as a clickable badge on non-draft PO views.

### No other files change

- PO receiving logic is unaffected — `workOrderId` is informational only
- MRP engine doesn't need changes — linking is manual in V2
- Dashboard/reports don't need changes yet

## Edge cases

| Case | Behavior |
|------|----------|
| Bulk convert with mix of purchase + produce | 400 error — bulk endpoint only handles purchase suggestions. Use single convert for produce |
| Bulk convert includes already-converted result | 400 error with message identifying which result is already converted |
| Two results for same item + same supplier | Both become separate lines on the same PO (different quantities/dates are meaningful) |
| Result has no linked supplier | 400 error with item part number — same as V1 single convert |
| Empty `resultIds` array | 400 validation error from Zod |
| Selecting all suggested + clicking bulk convert | Works — groups by supplier, creates minimum number of POs |
| PO line links to a WO that gets cancelled | Link remains (informational) — no cascading behavior |
| PO line links to a WO from different tenant | Prevented by the WO dropdown only showing same-tenant WOs |
| Bulk convert with 100+ results | Capped at 100 by validation schema to prevent transaction timeouts |

## Verification

After implementation, run these checks:

### 1. Automated tests
Run the MRP and PO e2e tests to confirm nothing is broken:
```bash
cd client && npx playwright test tests/e2e/09-purchase-orders.spec.js tests/e2e/11-mrp-engine.spec.js tests/e2e/15-end-to-end-flow.spec.js
```
All previously passing tests should still pass. The existing single-convert flow is unchanged.

### 2. Manual API test — bulk conversion
Set up two items from the same supplier with open demand. Run MRP. Then:
```bash
# Get the run results
GET /mrp/runs/{runId}/results?actionType=purchase&status=suggested

# Bulk convert all purchase suggestions
POST /mrp/runs/{runId}/results/convert-bulk
{ "resultIds": ["{id1}", "{id2}"] }

# Verify: one PO created with two lines
# Verify: both MRP results now have status "converted"
# Verify: PO expectedDate matches the earliest dateNeeded
```

### 3. Frontend sanity check
Navigate to MRP results page after a run with multiple purchase suggestions:
- Checkboxes appear on suggested purchase rows
- "Select All" toggles all suggested rows
- Clicking "Create POs" shows consolidated PO count in toast
- Converted rows lose checkboxes, show "Converted" badge

### 4. PO-WO link check
Create a PO manually. Edit it. Verify the "For WO" dropdown appears on each line with open work orders listed. Select a WO, save, reload — the link persists. View a sent PO — linked WO shows as a badge/label.

### 5. Write a focused test (optional)
Consider adding `server/scripts/test-po-consolidation.js` that:
1. Creates 3 items linked to 2 suppliers
2. Creates demand for a finished good that requires all 3
3. Runs MRP
4. Calls bulk convert with all purchase suggestion IDs
5. Asserts: 2 POs created (one per supplier), correct line counts, all results marked converted
6. Cleans up test data
