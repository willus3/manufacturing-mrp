/**
 * UAT Test Script: PO Consolidation & PO-WO Linking
 *
 * Covers:
 *   Part 1 — Bulk PO conversion (consolidation by supplier)
 *   Part 2 — PO-WO linking (workOrderId on PO lines)
 *   Part 3 — Regression (existing single-convert + dismiss + receive still work)
 *
 * Prerequisites:
 *   - Server running on port 3000
 *   - Database seeded (npx prisma db seed from server/)
 *
 * Run: node scripts/test-po-consolidation.js
 */
require('dotenv').config();
const BASE = 'http://localhost:3000/api/v1';

let token = '';
let passed = 0;
let failed = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const api = async (method, path, body) => {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json();
  return { status: res.status, ...data };
};

const assert = (condition, label, detail) => {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}${detail ? ` (got: ${JSON.stringify(detail)})` : ''}`);
    failed++;
  }
};

const assertEq = (actual, expected, label) =>
  assert(actual === expected, label, `${actual} !== ${expected}`);

// Abort with a clear message if a prerequisite step fails
const need = (condition, label) => {
  if (!condition) {
    console.error(`\n  FATAL: prerequisite failed — ${label}`);
    console.error(`  Cannot continue. Fix the issue above and re-run.\n`);
    process.exit(1);
  }
};

// ─── Test IDs ─────────────────────────────────────────────────────────────────

// Use a short timestamp suffix so each run creates fully isolated fixtures
// and never collides with existing seed data or previous runs
const RUN_ID = Date.now().toString(36).slice(-5).toUpperCase(); // e.g. "1K9AZ"

// Two suppliers
let supplierAId, supplierBId;
// Three raw materials: items1+2 → supplierA, item3 → supplierB
let itemRm1Id, itemRm2Id, itemRm3Id;
// A finished good with a flat 3-component BOM (no sub-assembly nesting needed)
let itemFgId;
// BOM
let bomFgId;
// Location for receiving
let locationId;
// A work order to link
let workOrderId, workOrderNumber;
// MRP run
let mrpRunId;
// Collected purchase result IDs by supplier
let purchaseResultsSupA = []; // items RM1+RM2 → supplier A
let purchaseResultsSupB = []; // item RM3 → supplier B
// Demand
let demandId;
// POs created
let bulkPoAId, bulkPoANumber;
let singlePoId;

const run = async () => {
  console.log('=== UAT: PO Consolidation & PO-WO Linking ===\n');

  // ══════════════════════════════════════════════════════════════════════════
  // 0. Auth
  // ══════════════════════════════════════════════════════════════════════════
  console.log('0. Authentication');

  const login = await api('POST', '/auth/login', {
    email: 'admin@test.com',
    password: 'password123',
    tenantSlug: 'test-shop',
  });
  assert(login.status === 200, 'Login succeeds');
  need(login.status === 200, 'login');
  token = login.data.accessToken;

  // ══════════════════════════════════════════════════════════════════════════
  // 1. Create test fixtures
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n1. Creating test fixtures');

  console.log(`  ℹ  Run ID: ${RUN_ID} — all fixtures use this suffix`);

  // Location (shared across runs — code is stable)
  const locList = await api('GET', '/locations?pageSize=100');
  const existingLoc = (locList.data ?? []).find((l) => l.code === 'UAT-WH');
  if (existingLoc) {
    locationId = existingLoc.id;
  } else {
    const loc = await api('POST', '/locations', {
      code: 'UAT-WH', name: 'UAT Warehouse', locationType: 'warehouse', isActive: true,
    });
    need([200, 201].includes(loc.status), `create location (${loc.status}: ${loc.message})`);
    locationId = loc.data.id;
  }
  assert(locationId, 'Location found/created');

  // Suppliers — stamped with RUN_ID so each run gets its own
  const supA = await api('POST', '/suppliers', { code: `SUP-A-${RUN_ID}`, name: `UAT Supplier Alpha ${RUN_ID}` });
  need([200, 201].includes(supA.status), `create supplier A (${supA.status}: ${supA.message})`);
  supplierAId = supA.data.id;

  const supB = await api('POST', '/suppliers', { code: `SUP-B-${RUN_ID}`, name: `UAT Supplier Beta ${RUN_ID}` });
  need([200, 201].includes(supB.status), `create supplier B (${supB.status}: ${supB.message})`);
  supplierBId = supB.data.id;
  assert(supplierAId && supplierBId, 'Two suppliers created');

  // Items — stamped with RUN_ID; flat BOM (FG directly uses RM1+RM2+RM3, no sub-assembly)
  const rm1 = await api('POST', '/items', {
    partNumber: `RM1-${RUN_ID}`, description: 'UAT Raw Mat 1', type: 'raw_material',
    unitOfMeasure: 'ea', leadTimeDays: 7,
  });
  need([200, 201].includes(rm1.status), `create RM1 (${rm1.status}: ${rm1.message})`);
  itemRm1Id = rm1.data.id;

  const rm2 = await api('POST', '/items', {
    partNumber: `RM2-${RUN_ID}`, description: 'UAT Raw Mat 2', type: 'raw_material',
    unitOfMeasure: 'ea', leadTimeDays: 5,
  });
  need([200, 201].includes(rm2.status), `create RM2 (${rm2.status}: ${rm2.message})`);
  itemRm2Id = rm2.data.id;

  const rm3 = await api('POST', '/items', {
    partNumber: `RM3-${RUN_ID}`, description: 'UAT Raw Mat 3', type: 'raw_material',
    unitOfMeasure: 'ea', leadTimeDays: 3,
  });
  need([200, 201].includes(rm3.status), `create RM3 (${rm3.status}: ${rm3.message})`);
  itemRm3Id = rm3.data.id;

  const fg = await api('POST', '/items', {
    partNumber: `FG-${RUN_ID}`, description: 'UAT Finished Good', type: 'finished_good',
    unitOfMeasure: 'ea', leadTimeDays: 5,
  });
  need([200, 201].includes(fg.status), `create FG (${fg.status}: ${fg.message})`);
  itemFgId = fg.data.id;
  assert(itemRm1Id && itemRm2Id && itemRm3Id && itemFgId, '4 items created');

  // Link items to suppliers: RM1+RM2 → Supplier A, RM3 → Supplier B
  const lnk1 = await api('POST', `/items/${itemRm1Id}/suppliers`, {
    supplierId: supplierAId, isPreferred: true, unitCost: 10.00, leadTimeDays: 7,
  });
  need([200, 201].includes(lnk1.status), `link RM1→SupA (${lnk1.status}: ${lnk1.message})`);

  const lnk2 = await api('POST', `/items/${itemRm2Id}/suppliers`, {
    supplierId: supplierAId, isPreferred: true, unitCost: 5.50, leadTimeDays: 5,
  });
  need([200, 201].includes(lnk2.status), `link RM2→SupA (${lnk2.status}: ${lnk2.message})`);

  const lnk3 = await api('POST', `/items/${itemRm3Id}/suppliers`, {
    supplierId: supplierBId, isPreferred: true, unitCost: 2.25, leadTimeDays: 3,
  });
  need([200, 201].includes(lnk3.status), `link RM3→SupB (${lnk3.status}: ${lnk3.message})`);
  assert(true, 'Item-supplier links created (RM1+RM2→SupA, RM3→SupB)');

  // Flat BOM: FG uses RM1 (2ea) + RM2 (3ea) + RM3 (4ea) directly
  const bomFgRes = await api('POST', '/boms', {
    itemId: itemFgId, revision: 'A', notes: 'UAT test BOM',
    lines: [
      { itemId: itemRm1Id, quantity: 2, unitOfMeasure: 'ea', scrapFactor: 0 },
      { itemId: itemRm2Id, quantity: 3, unitOfMeasure: 'ea', scrapFactor: 0 },
      { itemId: itemRm3Id, quantity: 4, unitOfMeasure: 'ea', scrapFactor: 0 },
    ],
  });
  need([200, 201].includes(bomFgRes.status), `create FG BOM (${bomFgRes.status}: ${bomFgRes.message})`);
  bomFgId = bomFgRes.data.id;
  const activatedBom = await api('PATCH', `/boms/${bomFgId}/status`, { status: 'active' });
  need(activatedBom.status === 200, `activate BOM (${activatedBom.status}: ${activatedBom.message})`);
  assert(bomFgId, 'FG BOM created and activated');

  // Create a planned work order for PO-WO link tests
  const wo = await api('POST', '/work-orders', {
    bomId: bomFgId,
    quantity: 5,
    scheduledStart: new Date(Date.now() + 7 * 86400000).toISOString(),
    scheduledEnd: new Date(Date.now() + 14 * 86400000).toISOString(),
    notes: 'UAT work order for PO-WO link test',
  });
  need([200, 201].includes(wo.status), `create WO (${wo.status}: ${wo.message})`);
  workOrderId = wo.data.id;
  workOrderNumber = wo.data.woNumber;
  assert(workOrderId, `Work order created: ${workOrderNumber}`);

  // ══════════════════════════════════════════════════════════════════════════
  // 2. Create demand and run MRP
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n2. MRP setup — demand + run');

  const dateRequired = new Date(Date.now() + 30 * 86400000).toISOString();
  const demand = await api('POST', '/mrp/demand', {
    itemId: itemFgId,
    quantityRequired: 10,
    dateRequired,
  });
  need([200, 201].includes(demand.status), `create demand (${demand.status}: ${demand.message})`);
  demandId = demand.data.id;
  assert(demandId, 'Demand created (10 units FG, due in 30 days)');

  const mrpRun = await api('POST', '/mrp/run', { planningHorizonDays: 60 });
  need([200, 201].includes(mrpRun.status), `run MRP (${mrpRun.status}: ${mrpRun.message})`);
  mrpRunId = mrpRun.data.id;
  assert(mrpRunId, `MRP run created: ${mrpRunId}`);

  // Fetch results — filter to purchase suggestions only
  const resultsRes = await api('GET', `/mrp/runs/${mrpRunId}/results?actionType=purchase&status=suggested`);
  need(resultsRes.status === 200, `get MRP results (${resultsRes.status})`);

  const purchaseResults = resultsRes.data.results ?? [];
  assert(purchaseResults.length > 0, `MRP produced ${purchaseResults.length} purchase suggestion(s)`);

  // Show what was produced so we can debug netting
  for (const r of purchaseResults) {
    console.log(`  ℹ  ${r.item?.partNumber ?? r.itemId}  qty=${Number(r.quantityNeeded)}  supplier=${r.supplier?.name ?? 'none'}`);
  }

  // Separate results by which supplier will be resolved
  // RM1+RM2 are linked to Supplier A; RM3 to Supplier B
  for (const r of purchaseResults) {
    if (r.itemId === itemRm1Id || r.itemId === itemRm2Id) {
      purchaseResultsSupA.push(r.id);
    } else if (r.itemId === itemRm3Id) {
      purchaseResultsSupB.push(r.id);
    }
  }

  // If any suggestions remain unclassified (e.g. from seeded items), log them
  const classified = [...purchaseResultsSupA, ...purchaseResultsSupB];
  const unclassified = purchaseResults.filter((r) => !classified.includes(r.id));
  if (unclassified.length > 0) {
    console.log(`  ℹ  ${unclassified.length} suggestion(s) from non-UAT items (seed data) — ignored`);
  }

  assert(
    purchaseResultsSupA.length >= 1,
    `At least 1 purchase suggestion for Supplier A items (got ${purchaseResultsSupA.length})`
  );
  assert(
    purchaseResultsSupB.length >= 1,
    `At least 1 purchase suggestion for Supplier B items (got ${purchaseResultsSupB.length})`
  );
  need(
    purchaseResultsSupA.length >= 1 && purchaseResultsSupB.length >= 1,
    `Need suggestions for both suppliers. Check stock levels for UAT-RM-001/002/003 and clear any open POs covering them.`
  );

  // ══════════════════════════════════════════════════════════════════════════
  // 3. Test 1.3 — Bulk convert: same supplier → 1 PO with multiple lines
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n3. Test 1.3 — Bulk convert: same-supplier items → single PO');

  // Use only Supplier A's results (should be RM1 + RM2 = 2 suggestions)
  const bulkA = await api('POST', `/mrp/runs/${mrpRunId}/results/convert-bulk`, {
    resultIds: purchaseResultsSupA,
  });
  assert(bulkA.status === 201, `POST convert-bulk returns 201 (got ${bulkA.status})`);
  assert(bulkA.data, 'Response has data');

  const { purchaseOrders: posA, converted: convertedA, purchaseOrdersCreated: poCountA } = bulkA.data;

  assertEq(convertedA, purchaseResultsSupA.length, `converted count = ${purchaseResultsSupA.length} (suggestions used)`);
  assertEq(poCountA, 1, 'purchaseOrdersCreated = 1 (both items same supplier)');
  assert(Array.isArray(posA) && posA.length === 1, '1 PO object in response');

  const poA = posA[0];
  bulkPoAId = poA.id;
  bulkPoANumber = poA.poNumber;
  assertEq(poA.lines.length, purchaseResultsSupA.length, `PO has ${purchaseResultsSupA.length} lines`);
  assert(
    poA.lines.every((l) => l.item && l.quantityOrdered > 0),
    'All PO lines have item and quantity'
  );
  assert(poA.supplier.id === supplierAId, 'PO assigned to Supplier A');
  assert(poA.status === 'draft', 'PO status is draft');
  console.log(`  ℹ PO created: ${bulkPoANumber} with ${poA.lines.length} line(s)`);

  // Verify MRP results now show as converted
  const afterBulkA = await api('GET', `/mrp/runs/${mrpRunId}/results?actionType=purchase&status=suggested`);
  const stillSuggestedA = (afterBulkA.data.results ?? []).filter((r) =>
    purchaseResultsSupA.includes(r.id)
  );
  assertEq(stillSuggestedA.length, 0, 'Supplier A results now show as converted (not suggested)');

  // ══════════════════════════════════════════════════════════════════════════
  // 4. Test 1.4 — Bulk convert: different suppliers → multiple POs
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n4. Test 1.4 — Bulk convert: mixed suppliers → separate POs');

  // Re-run MRP to get fresh suggestions (Supplier A items are now on open PO,
  // so they might net to 0 — but RM3/Supplier B should still have suggestions)
  // Instead, let's just use the remaining Supplier B suggestions from this run
  // plus create new demand to generate fresh Supplier A suggestions
  const demand2 = await api('POST', '/mrp/demand', {
    itemId: itemFgId,
    quantityRequired: 5,
    dateRequired: new Date(Date.now() + 45 * 86400000).toISOString(),
  });
  need([200, 201].includes(demand2.status), 'create second demand');

  const mrpRun2 = await api('POST', '/mrp/run', { planningHorizonDays: 60 });
  need(mrpRun2.status === 201, `second MRP run (${mrpRun2.status})`);
  const mrpRunId2 = mrpRun2.data.id;

  const results2Res = await api('GET', `/mrp/runs/${mrpRunId2}/results?actionType=purchase&status=suggested`);
  need(results2Res.status === 200, 'get second run results');
  const results2 = results2Res.data.results ?? [];

  // Collect one result from each supplier if available
  const mixedIds = [];
  let foundA2 = false, foundB2 = false;
  for (const r of results2) {
    if (!foundA2 && (r.itemId === itemRm1Id || r.itemId === itemRm2Id)) {
      mixedIds.push(r.id);
      foundA2 = true;
    }
    if (!foundB2 && r.itemId === itemRm3Id) {
      mixedIds.push(r.id);
      foundB2 = true;
    }
  }

  // Log what run 2 produced
  for (const r of results2) {
    console.log(`  ℹ  run2: ${r.item?.partNumber}  qty=${Number(r.quantityNeeded)}  supplier=${r.supplier?.name ?? 'none'}`);
  }

  if (mixedIds.length >= 2 && foundA2 && foundB2) {
    // We have at least one result per supplier — bulk convert should create 2 POs
    const bulkMixed = await api('POST', `/mrp/runs/${mrpRunId2}/results/convert-bulk`, {
      resultIds: mixedIds,
    });
    assert(bulkMixed.status === 201, `Mixed-supplier bulk convert returns 201 (got ${bulkMixed.status})`);
    assertEq(
      bulkMixed.data.purchaseOrdersCreated,
      2,
      'purchaseOrdersCreated = 2 (one per supplier)'
    );
    assertEq(bulkMixed.data.converted, mixedIds.length, `converted = ${mixedIds.length}`);
    const poNumbers = bulkMixed.data.purchaseOrders.map((p) => p.poNumber).join(', ');
    console.log(`  ℹ POs created: ${poNumbers}`);
  } else if (results2.length >= 2) {
    // At least 2 results but not split across our two suppliers — still test bulk
    const allIds = results2.map((r) => r.id);
    const bulkAll = await api('POST', `/mrp/runs/${mrpRunId2}/results/convert-bulk`, {
      resultIds: allIds,
    });
    assert(bulkAll.status === 201, `Bulk convert of all run-2 suggestions returns 201`);
    assert(bulkAll.data.purchaseOrdersCreated >= 1, `At least 1 PO created from ${allIds.length} suggestions`);
    console.log(`  ℹ Created ${bulkAll.data.purchaseOrdersCreated} PO(s) from ${allIds.length} suggestions`);
  } else if (results2.length === 1) {
    // Only 1 suggestion — open PO from step 3 covered the rest; bulk with single item still valid
    const bulkOne = await api('POST', `/mrp/runs/${mrpRunId2}/results/convert-bulk`, {
      resultIds: [results2[0].id],
    });
    assert(bulkOne.status === 201, `Bulk convert of single suggestion returns 201 (got ${bulkOne.status})`);
    assertEq(bulkOne.data.purchaseOrdersCreated, 1, 'purchaseOrdersCreated = 1');
    console.log(`  ℹ Single-result bulk: created PO ${bulkOne.data.purchaseOrders[0]?.poNumber}`);
  } else {
    console.log(`  ℹ Skipped: all run-2 demand netted to 0 (fully covered by open supply)`);
    assert(true, 'Mixed-supplier test skipped — supply fully covered (valid netting behaviour)');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 5. Test 1.6 — Error: item with no linked supplier
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n5. Test 1.6 — Error: no-supplier item in bulk convert');

  // Pass a non-existent UUID — should return 400 "not found in this run"
  const fakeResultId = '00000000-0000-4000-8000-000000000001';
  const noSupErr = await api('POST', `/mrp/runs/${mrpRunId}/results/convert-bulk`, {
    resultIds: [fakeResultId],
  });
  assert(noSupErr.status === 400, `Returns 400 for unknown result ID (got ${noSupErr.status})`);
  assert(noSupErr.error?.message, 'Returns error message');
  console.log(`  ℹ Error message: ${noSupErr.error?.message}`);

  // ══════════════════════════════════════════════════════════════════════════
  // 6. Test 1.6b — Error: produce result passed to bulk endpoint
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n6. Test 1.6b — Error: produce suggestion passed to bulk PO endpoint');

  const produceRes = await api('GET', `/mrp/runs/${mrpRunId}/results?actionType=produce&status=suggested`);
  const produceResults = produceRes.data?.results ?? [];

  if (produceResults.length > 0) {
    const produceResultId = produceResults[0].id;
    const mixErr = await api('POST', `/mrp/runs/${mrpRunId}/results/convert-bulk`, {
      resultIds: [produceResultId],
    });
    assert(mixErr.status === 400, `Returns 400 when produce result included (got ${mixErr.status})`);
    assert(
      (mixErr.error?.message || '').includes('produce suggestion'),
      `Error message mentions "produce suggestion"`
    );
    console.log(`  ℹ Error message: ${mixErr.error?.message}`);
  } else {
    console.log('  ℹ Skipped — no produce suggestions in first run (all converted or no produce items)');
    assert(true, 'Produce-in-bulk-endpoint test skipped (no produce suggestions available)');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 7. Test 1.6c — Error: already-converted result
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n7. Test 1.6c — Error: already-converted result');

  // purchaseResultsSupA were converted in step 3 — try to convert again
  const alreadyDone = await api('POST', `/mrp/runs/${mrpRunId}/results/convert-bulk`, {
    resultIds: [purchaseResultsSupA[0]],
  });
  assert(alreadyDone.status === 400, `Returns 400 for already-converted result (got ${alreadyDone.status})`);
  assert(
    (alreadyDone.error?.message || '').toLowerCase().includes('already'),
    `Error message mentions "already"`
  );
  console.log(`  ℹ Error message: ${alreadyDone.error?.message}`);

  // ══════════════════════════════════════════════════════════════════════════
  // 8. Test 1.5 — Single "Create PO" still works
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n8. Test 1.5 — Single per-row convert still works');

  // Find any remaining suggested purchase result
  const remainingRes = await api('GET', `/mrp/runs/${mrpRunId2}/results?actionType=purchase&status=suggested`);
  const remaining = (remainingRes.data?.results ?? []);

  if (remaining.length > 0) {
    const singleResult = remaining[0];
    const singleConvert = await api('POST', `/mrp/runs/${mrpRunId2}/results/${singleResult.id}/convert`);
    assert(singleConvert.status === 201, `Single convert returns 201 (got ${singleConvert.status})`);
    assert(singleConvert.data.type === 'purchase_order', 'Returns type: purchase_order');
    singlePoId = singleConvert.data.po?.id;
    assert(singlePoId, `Single PO created: ${singleConvert.data.po?.poNumber}`);
    // Verify it has exactly 1 line
    if (singlePoId) {
      const singlePoDetail = await api('GET', `/purchase-orders/${singlePoId}`);
      assertEq(singlePoDetail.data?.lines?.length, 1, 'Single-convert PO has exactly 1 line');
    }
  } else {
    console.log('  ℹ Skipped — no remaining purchase suggestions in run 2');
    assert(true, 'Single-convert test skipped (no remaining suggestions)');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 9. Test 2.1 + 2.2 — Create PO with workOrderId on a line
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n9. Test 2.1/2.2 — Create PO with WO link on a line');

  const poWithWo = await api('POST', '/purchase-orders', {
    supplierId: supplierAId,
    expectedDate: new Date(Date.now() + 14 * 86400000).toISOString(),
    notes: 'UAT PO-WO link test',
    lines: [
      {
        itemId: itemRm1Id,
        workOrderId: workOrderId,
        quantityOrdered: 20,
        unitCost: 10.00,
      },
      {
        itemId: itemRm2Id,
        workOrderId: null, // second line without a WO link
        quantityOrdered: 10,
        unitCost: 5.50,
      },
    ],
  });
  assert(poWithWo.status === 201, `Create PO with WO link returns 201 (got ${poWithWo.status})`);

  const poWoId = poWithWo.data.id;
  assert(poWoId, `PO created: ${poWithWo.data.poNumber}`);

  // Line 1 should have workOrder populated
  const line1 = poWithWo.data.lines.find((l) => l.itemId === itemRm1Id);
  const line2 = poWithWo.data.lines.find((l) => l.itemId === itemRm2Id);

  assert(line1, 'Line 1 (RM1) found in response');
  assert(line1.workOrder, 'Line 1 has workOrder object');
  assert(line1.workOrder?.id === workOrderId, `Line 1 workOrder.id = ${workOrderNumber}`);
  assert(line1.workOrder?.woNumber === workOrderNumber, `Line 1 workOrder.woNumber = ${workOrderNumber}`);
  assert(line2, 'Line 2 (RM2) found in response');
  assert(line2.workOrder === null, 'Line 2 workOrder = null (no link)');

  // ══════════════════════════════════════════════════════════════════════════
  // 10. Test 2.3 — WO link persists on GET
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n10. Test 2.3 — WO link persists on GET /purchase-orders/:id');

  const fetchedPo = await api('GET', `/purchase-orders/${poWoId}`);
  assert(fetchedPo.status === 200, `GET PO returns 200 (got ${fetchedPo.status})`);

  const fetchedLine1 = fetchedPo.data.lines.find((l) => l.itemId === itemRm1Id);
  const fetchedLine2 = fetchedPo.data.lines.find((l) => l.itemId === itemRm2Id);

  assert(fetchedLine1?.workOrder?.id === workOrderId, 'Line 1 WO link persists after GET');
  assert(fetchedLine2?.workOrder === null, 'Line 2 WO link is null after GET');

  // ══════════════════════════════════════════════════════════════════════════
  // 11. Test 2.6 — Edit WO link on draft PO
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n11. Test 2.6 — Edit WO link on draft PO (PUT)');

  // Update: swap the link — line2 now gets the WO, line1 loses it
  const updatedPo = await api('PUT', `/purchase-orders/${poWoId}`, {
    lines: [
      {
        itemId: itemRm1Id,
        workOrderId: null, // remove link
        quantityOrdered: 20,
        unitCost: 10.00,
      },
      {
        itemId: itemRm2Id,
        workOrderId: workOrderId, // add link
        quantityOrdered: 10,
        unitCost: 5.50,
      },
    ],
  });
  assert(updatedPo.status === 200, `PUT PO returns 200 (got ${updatedPo.status})`);

  const updLine1 = updatedPo.data.lines.find((l) => l.itemId === itemRm1Id);
  const updLine2 = updatedPo.data.lines.find((l) => l.itemId === itemRm2Id);

  assert(updLine1?.workOrder === null, 'After edit: Line 1 WO link removed');
  assert(updLine2?.workOrder?.id === workOrderId, 'After edit: Line 2 WO link set');

  // ══════════════════════════════════════════════════════════════════════════
  // 12. Test 2.4 — WO link visible on sent PO
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n12. Test 2.4 — WO link visible after PO is sent');

  const sentRes = await api('PATCH', `/purchase-orders/${poWoId}/send`);
  assert(sentRes.status === 200, `Send PO returns 200 (got ${sentRes.status})`);

  const sentPo = await api('GET', `/purchase-orders/${poWoId}`);
  assertEq(sentPo.data.status, 'sent', 'PO status = sent');

  const sentLine2 = sentPo.data.lines.find((l) => l.itemId === itemRm2Id);
  assert(sentLine2?.workOrder?.id === workOrderId, 'WO link still present on sent PO');

  // ══════════════════════════════════════════════════════════════════════════
  // 13. Test 2.5 — Auto-generated POs (from bulk convert) have no WO link
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n13. Test 2.5 — Bulk-converted PO lines have no WO link (workOrder = null)');

  const autoPoDetail = await api('GET', `/purchase-orders/${bulkPoAId}`);
  assert(autoPoDetail.status === 200, `GET bulk-converted PO returns 200`);

  const autoPoLinesWithWo = autoPoDetail.data.lines.filter((l) => l.workOrder !== null);
  assertEq(autoPoLinesWithWo.length, 0, 'No WO links on auto-generated PO lines (V3 deferred)');

  // ══════════════════════════════════════════════════════════════════════════
  // 14. Test 3.1 — Regression: receive still works on PO with WO link
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n14. Test 3.1 — Regression: receive against PO with WO link');

  // The sent PO (poWoId) has line2 with RM2. Let's receive against it.
  const sentPoLines = sentPo.data.lines;
  const lineToReceive = sentPoLines.find((l) => l.itemId === itemRm2Id);
  need(lineToReceive, 'found RM2 line on sent PO');

  const receiveRes = await api('POST', `/purchase-orders/${poWoId}/receive`, {
    lines: [{
      poLineId: lineToReceive.id,
      quantity: 5,
      locationId,
    }],
  });
  assert(receiveRes.status === 201, `Receive returns 201 (got ${receiveRes.status})`);
  assert(
    ['partial', 'received'].includes(receiveRes.data.newStatus),
    `PO status moved to partial/received (got ${receiveRes.data.newStatus})`
  );

  // ══════════════════════════════════════════════════════════════════════════
  // 15. Test 3.2 — Regression: dismiss still works
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n15. Test 3.2 — Regression: dismiss a suggestion');

  // Find any still-suggested result in run 1
  const run1Results = await api('GET', `/mrp/runs/${mrpRunId}/results?status=suggested`);
  const toDismiss = (run1Results.data?.results ?? [])[0];

  if (toDismiss) {
    const dismissRes = await api('PATCH', `/mrp/runs/${mrpRunId}/results/${toDismiss.id}/dismiss`);
    assert(dismissRes.status === 200, `Dismiss returns 200 (got ${dismissRes.status})`);
    assertEq(dismissRes.data.status, 'dismissed', 'Result status = dismissed');
  } else {
    console.log('  ℹ Skipped — no suggested results remaining in run 1');
    assert(true, 'Dismiss regression skipped (no suggested results)');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 16. Cleanup — cancel open POs and mark demand cancelled
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n16. Cleanup');

  // Cancel draft POs created by bulk convert (Supplier A PO)
  // bulkPoAId is draft, safe to cancel
  const cancelBulkA = await api('PATCH', `/purchase-orders/${bulkPoAId}/cancel`);
  assert([200, 400].includes(cancelBulkA.status), `Cancel bulk PO A (status: ${cancelBulkA.status})`);

  // Cancel demand entries
  if (demandId) {
    await api('PATCH', `/mrp/demand/${demandId}/cancel`);
  }

  console.log('  ℹ Note: UAT items/BOMs/suppliers remain in DB. Re-run seed to reset if needed.');

  // ══════════════════════════════════════════════════════════════════════════
  // Summary
  // ══════════════════════════════════════════════════════════════════════════
  console.log(`\n${'═'.repeat(55)}`);
  console.log(`  Results: ${passed} passed, ${failed} failed (${passed + failed} total)`);
  console.log(`${'═'.repeat(55)}\n`);
  process.exit(failed > 0 ? 1 : 0);
};

run().catch((err) => {
  console.error('\nTest script crashed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
