# V2: MRP Lead Time Cascading

## Problem

V1's MRP engine uses a single-level lead time offset. When netting produces a suggestion, it calculates `suggestedOrderDate = dateNeeded - item.leadTimeDays`. But it passes the **same `dateNeeded`** to every level of the BOM explosion — children get the parent's due date, not an offset date.

Example: demand for a Dining Table (lead time: 5 days) on June 30.
- Table Top sub-assembly (lead time: 3 days) also gets dateNeeded = June 30.
- Oak Lumber raw material (supplier lead time: 14 days) also gets dateNeeded = June 30.

The lumber PO would suggest ordering on June 16 (30 - 14), but the table top needs to be ready by June 25 (30 - 5) and the lumber needs to arrive by June 22 (25 - 3). The current engine suggests June 16 instead of June 8.

**Result:** Suggested order dates for deep components are too late. The further down the BOM tree, the more the error compounds.

## Solution

Cascade lead times through the BOM explosion. Before recursing into children, subtract the **parent item's** `leadTimeDays` from `dateNeeded`. This makes each level's `dateNeeded` earlier than its parent's, reflecting real-world manufacturing timing.

### After the fix:
- Dining Table demand: June 30
  - Table Top sub-assembly dateNeeded: June 25 (30 - 5 days table lead time)
    - Oak Lumber dateNeeded: June 22 (25 - 3 days sub-assembly lead time)
      - suggestedOrderDate: June 8 (22 - 14 days supplier lead time)

## Files to modify

### `server/src/mrp/mrp.service.js`

**Function: `explodeBom()`** (lines 339-370)

Current code passes `dateNeeded` unchanged to all children:
```js
// line 368
await explodeBom(tenantId, line.itemId, componentQty, dateNeeded, requirements, nextVisited);
```

Change: before recursing, compute a child-specific `dateNeeded` by subtracting the current item's lead time:
```js
// Look up the current item's lead time to offset children's dates
const currentItem = await prisma.item.findUnique({
  where: { id: itemId },
  select: { leadTimeDays: true },
});
const parentLeadTime = currentItem?.leadTimeDays || 0;
const childDateNeeded = new Date(dateNeeded);
childDateNeeded.setDate(childDateNeeded.getDate() - parentLeadTime);

for (const line of bom.bomLines) {
  const componentQty = Math.round(
    Number(line.quantity) * parentQty * (1 + Number(line.scrapFactor || 0)) * 100
  ) / 100;
  await explodeBom(tenantId, line.itemId, componentQty, childDateNeeded, requirements, nextVisited);
}
```

**Performance note:** This adds one extra `findUnique` per BOM level (not per line — once per parent item). For a typical 3-level BOM, that's 2-3 extra queries per demand entry, which is negligible.

**Function: `addRequirement()`** (lines 373-383) — no changes needed. It already keeps the earliest `dateNeeded`, so cascaded dates naturally propagate.

### No other files change

- The netting loop (lines 200-286) already reads `dateNeeded` from the requirements map and applies item-level `leadTimeDays` to compute `suggestedOrderDate`. Cascading affects what goes *into* the map, not how it's read out.
- Frontend pages display `dateNeeded` and `suggestedOrderDate` from the API response — no changes.
- Schema unchanged — no new fields.

## Edge cases

| Case | Behavior |
|------|----------|
| Item has no `leadTimeDays` | Defaults to 0 — children get the same `dateNeeded` as parent (V1 behavior) |
| `childDateNeeded` is in the past | Still stored — planner sees the date is already overdue and can decide how to handle it |
| Circular BOM reference | `explodeBom` already skips via the `visited` Set — no change needed |
| Single-level BOM (no sub-assemblies) | Only one level of offset — functionally identical to V1 |

## Verification

After implementation, run these checks:

### 1. Automated tests
Run the MRP-related e2e tests to confirm nothing is broken:
```bash
cd client && npx playwright test tests/e2e/11-mrp-engine.spec.js tests/e2e/15-end-to-end-flow.spec.js
```
All previously passing tests should still pass.

### 2. Manual API test — cascading dates
Set up a 3-level BOM with known lead times:
- FG item (leadTimeDays: 5)
  - SA sub-assembly (leadTimeDays: 3)
    - RAW material (supplier lead time: 14)

Create a demand for the FG item due in 30 days. Run MRP. Check the results:
- FG produce suggestion: `dateNeeded` = demand date, `suggestedOrderDate` = demand date - 5
- SA produce suggestion: `dateNeeded` = demand date - 5
- RAW purchase suggestion: `dateNeeded` = demand date - 8, `suggestedOrderDate` = demand date - 22

### 3. Dashboard sanity check
Navigate to the dashboard — verify no errors in the MRP card and that the last run shows correctly.

### 4. Write a focused test (optional)
Consider adding a test script at `server/scripts/test-lead-time-cascade.js` that:
1. Creates a 3-level BOM with known lead times
2. Creates demand
3. Runs MRP
4. Asserts that `dateNeeded` for each level is correctly offset
5. Cleans up test data
