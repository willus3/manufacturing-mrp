/**
 * Test script for Work Order API.
 * Tests: create, list, getById, update, status transitions,
 * material issue, and completion (inventory receipt).
 *
 * Prerequisites:
 *   - Server running on localhost:3000
 *   - Seeded database (admin@test.com / password123 / test-shop)
 *   - At least one active BOM, one active item, one active location
 */

const BASE = 'http://localhost:3000/api/v1';
const suffix = Date.now().toString().slice(-6);
let TOKEN = '';
let passed = 0;
let failed = 0;

const assert = (label, condition) => {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
};

const run = async () => {
  console.log('\n=== Work Order API Tests ===\n');

  // 1. Login
  console.log('1. Login');
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@test.com', password: 'password123', tenantSlug: 'test-shop' }),
  });
  const loginData = await loginRes.json();
  assert('Login succeeds', loginRes.status === 200);
  TOKEN = loginData.data.accessToken;

  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` };

  // 2. Create test data — we need an active BOM, which needs an item with a BOM
  console.log('\n2. Create prerequisite data');

  // Create a finished good item (the thing the BOM produces)
  const fgRes = await fetch(`${BASE}/items`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      partNumber: `WO-FG-${suffix}`,
      description: `WO Test Finished Good ${suffix}`,
      type: 'finished_good',
      unitOfMeasure: 'EA',
      trackingMethod: 'none',
    }),
  });
  const fgItem = (await fgRes.json()).data;
  assert('Created finished good item', fgRes.status === 201);

  // Create two raw material items (BOM components)
  const rm1Res = await fetch(`${BASE}/items`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      partNumber: `WO-RM1-${suffix}`,
      description: `WO Test Raw Material 1 ${suffix}`,
      type: 'raw_material',
      unitOfMeasure: 'EA',
      trackingMethod: 'none',
    }),
  });
  const rm1Item = (await rm1Res.json()).data;
  assert('Created raw material 1', rm1Res.status === 201);

  const rm2Res = await fetch(`${BASE}/items`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      partNumber: `WO-RM2-${suffix}`,
      description: `WO Test Raw Material 2 ${suffix}`,
      type: 'raw_material',
      unitOfMeasure: 'KG',
      trackingMethod: 'none',
    }),
  });
  const rm2Item = (await rm2Res.json()).data;
  assert('Created raw material 2', rm2Res.status === 201);

  // Create a BOM for the finished good
  const bomRes = await fetch(`${BASE}/boms`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      itemId: fgItem.id,
      revision: `WO-TEST-${suffix}`,
      lines: [
        { itemId: rm1Item.id, quantity: 2, unitOfMeasure: 'EA', position: 1, scrapFactor: 0.1 },
        { itemId: rm2Item.id, quantity: 0.5, unitOfMeasure: 'KG', position: 2, scrapFactor: 0 },
      ],
    }),
  });
  const bom = (await bomRes.json()).data;
  assert('Created BOM', bomRes.status === 201);

  // Activate the BOM
  const activateRes = await fetch(`${BASE}/boms/${bom.id}/status`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ status: 'active' }),
  });
  assert('Activated BOM', activateRes.status === 200);

  // Create a location for material issue
  const locRes = await fetch(`${BASE}/locations`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: `WO Test Location ${suffix}`,
      code: `WOTL${suffix}`,
    }),
  });
  const loc = (await locRes.json()).data;
  assert('Created location', locRes.status === 201);

  // Add stock for the raw materials so we can issue them
  const adj1Res = await fetch(`${BASE}/inventory/adjust`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      itemId: rm1Item.id,
      locationId: loc.id,
      quantity: 100,
      notes: 'WO test setup',
    }),
  });
  assert('Adjusted stock for RM1', adj1Res.status === 201);

  const adj2Res = await fetch(`${BASE}/inventory/adjust`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      itemId: rm2Item.id,
      locationId: loc.id,
      quantity: 50,
      notes: 'WO test setup',
    }),
  });
  assert('Adjusted stock for RM2', adj2Res.status === 201);

  // 3. Create a work order
  console.log('\n3. Create work order');
  const createRes = await fetch(`${BASE}/work-orders`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      bomId: bom.id,
      quantity: 10,
      priority: 5,
      scheduledStart: '2026-04-01',
      scheduledEnd: '2026-04-05',
      notes: 'Test WO',
    }),
  });
  const wo = (await createRes.json()).data;
  assert('Create returns 201', createRes.status === 201);
  assert('WO has number', wo.woNumber && wo.woNumber.startsWith('WO-'));
  assert('Status is planned', wo.status === 'planned');
  assert('Has 2 material lines', wo.lines?.length === 2);
  // RM1: qty 2 * 10 * (1+0.1) = 22
  const rm1Line = wo.lines.find((l) => l.item.partNumber === `WO-RM1-${suffix}`);
  assert('RM1 line qty = 22 (2*10*1.1)', Number(rm1Line?.quantityRequired) === 22);
  // RM2: qty 0.5 * 10 * (1+0) = 5
  const rm2Line = wo.lines.find((l) => l.item.partNumber === `WO-RM2-${suffix}`);
  assert('RM2 line qty = 5 (0.5*10*1.0)', Number(rm2Line?.quantityRequired) === 5);

  // 4. List work orders
  console.log('\n4. List work orders');
  const listRes = await fetch(`${BASE}/work-orders?page=1&pageSize=10`, {
    headers: authHeaders,
  });
  const listData = await listRes.json();
  assert('List returns 200', listRes.status === 200);
  assert('List has data array', Array.isArray(listData.data));
  assert('List includes our WO', listData.data.some((w) => w.id === wo.id));

  // 5. List with status filter
  console.log('\n5. Filter by status');
  const filteredRes = await fetch(`${BASE}/work-orders?status=planned`, {
    headers: authHeaders,
  });
  const filteredData = await filteredRes.json();
  assert('Filtered list returns 200', filteredRes.status === 200);
  assert('All results are planned', filteredData.data.every((w) => w.status === 'planned'));

  // 6. Get by ID
  console.log('\n6. Get by ID');
  const getRes = await fetch(`${BASE}/work-orders/${wo.id}`, {
    headers: authHeaders,
  });
  const getWo = (await getRes.json()).data;
  assert('Get returns 200', getRes.status === 200);
  assert('Has BOM info', !!getWo.bom);
  assert('Has creator info', !!getWo.creator);
  assert('Has lines with items', getWo.lines?.length === 2 && !!getWo.lines[0].item);

  // 7. Update planned WO
  console.log('\n7. Update planned WO');
  const updateRes = await fetch(`${BASE}/work-orders/${wo.id}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ priority: 10, notes: 'Updated notes' }),
  });
  const updated = (await updateRes.json()).data;
  assert('Update returns 200', updateRes.status === 200);
  assert('Priority updated to 10', updated.priority === 10);

  // 8. Status transitions: planned → released
  console.log('\n8. Status: planned → released');
  const releaseRes = await fetch(`${BASE}/work-orders/${wo.id}/status`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ status: 'released' }),
  });
  const released = (await releaseRes.json()).data;
  assert('Release returns 200', releaseRes.status === 200);
  assert('Status is released', released.workOrder.status === 'released');

  // 9. Cannot edit non-planned WO
  console.log('\n9. Cannot edit released WO');
  const editReleasedRes = await fetch(`${BASE}/work-orders/${wo.id}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ priority: 20 }),
  });
  assert('Edit released returns 400', editReleasedRes.status === 400);

  // 10. Invalid transition: released → planned
  console.log('\n10. Invalid transition');
  const invalidRes = await fetch(`${BASE}/work-orders/${wo.id}/status`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ status: 'planned' }),
  });
  assert('Invalid transition returns 400', invalidRes.status === 400);

  // 11. Status: released → in_progress
  console.log('\n11. Status: released → in_progress');
  const startRes = await fetch(`${BASE}/work-orders/${wo.id}/status`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ status: 'in_progress' }),
  });
  const started = (await startRes.json()).data;
  assert('Start returns 200', startRes.status === 200);
  assert('Status is in_progress', started.workOrder.status === 'in_progress');
  assert('actualStart is set', !!started.workOrder.actualStart);

  // 12. Issue material
  console.log('\n12. Issue material');
  // Get fresh WO to get line IDs
  const freshRes = await fetch(`${BASE}/work-orders/${wo.id}`, { headers: authHeaders });
  const freshWo = (await freshRes.json()).data;
  const line1 = freshWo.lines.find((l) => l.item.partNumber === `WO-RM1-${suffix}`);
  const line2 = freshWo.lines.find((l) => l.item.partNumber === `WO-RM2-${suffix}`);

  const issueRes = await fetch(`${BASE}/work-orders/${wo.id}/issue`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      lines: [
        { woLineId: line1.id, quantity: 22, locationId: loc.id },
        { woLineId: line2.id, quantity: 5, locationId: loc.id },
      ],
    }),
  });
  const issueData = (await issueRes.json()).data;
  assert('Issue returns 201', issueRes.status === 201);
  assert('Issued 2 lines', issueData.issued?.length === 2);

  // 13. Verify stock decreased
  console.log('\n13. Verify stock after issue');
  const stockRes = await fetch(`${BASE}/inventory/stock?itemId=${rm1Item.id}`, { headers: authHeaders });
  const stockData = await stockRes.json();
  const rm1Stock = stockData.data.find((s) => s.itemId === rm1Item.id);
  assert('RM1 stock decreased to 78 (100-22)', Number(rm1Stock?.quantityOnHand) === 78);

  // 14. Over-issue should fail
  console.log('\n14. Over-issue fails');
  const overIssueRes = await fetch(`${BASE}/work-orders/${wo.id}/issue`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      lines: [{ woLineId: line1.id, quantity: 1, locationId: loc.id }],
    }),
  });
  assert('Over-issue returns 400', overIssueRes.status === 400);

  // 15. Complete WO — should create inventory receipt for finished good
  console.log('\n15. Status: in_progress → completed');
  const completeRes = await fetch(`${BASE}/work-orders/${wo.id}/status`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ status: 'completed' }),
  });
  const completed = (await completeRes.json()).data;
  assert('Complete returns 200', completeRes.status === 200);
  assert('Status is completed', completed.workOrder.status === 'completed');
  assert('actualEnd is set', !!completed.workOrder.actualEnd);

  // 16. Verify finished goods stock increased
  console.log('\n16. Verify finished goods stock');
  const fgStockRes = await fetch(`${BASE}/inventory/stock?itemId=${fgItem.id}`, { headers: authHeaders });
  const fgStockData = await fgStockRes.json();
  const fgStock = fgStockData.data.find((s) => s.itemId === fgItem.id);
  assert('FG stock = 10 (WO quantity)', Number(fgStock?.quantityOnHand) === 10);

  // 17. Verify inventory transaction was created
  console.log('\n17. Verify completion inventory transaction');
  const txRes = await fetch(`${BASE}/inventory/transactions?itemId=${fgItem.id}`, { headers: authHeaders });
  const txData = await txRes.json();
  const receiptTx = txData.data.find(
    (t) => t.transactionType === 'receipt' && t.referenceType === 'work_order' && t.referenceId === wo.id
  );
  assert('Receipt transaction exists for FG', !!receiptTx);
  assert('Receipt qty = 10', Number(receiptTx?.quantity) === 10);

  // 18. Create another WO for cancel test
  console.log('\n18. Cancel with issued material (warning)');
  const wo2Res = await fetch(`${BASE}/work-orders`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ bomId: bom.id, quantity: 5, priority: 1 }),
  });
  const wo2 = (await wo2Res.json()).data;
  assert('Created second WO', wo2Res.status === 201);

  // Release and start it
  await fetch(`${BASE}/work-orders/${wo2.id}/status`, {
    method: 'PATCH', headers: authHeaders,
    body: JSON.stringify({ status: 'released' }),
  });
  await fetch(`${BASE}/work-orders/${wo2.id}/status`, {
    method: 'PATCH', headers: authHeaders,
    body: JSON.stringify({ status: 'in_progress' }),
  });

  // Issue some material
  const fresh2 = (await (await fetch(`${BASE}/work-orders/${wo2.id}`, { headers: authHeaders })).json()).data;
  const wo2line = fresh2.lines[0];
  await fetch(`${BASE}/work-orders/${wo2.id}/issue`, {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({
      lines: [{ woLineId: wo2line.id, quantity: 1, locationId: loc.id }],
    }),
  });

  // Cancel — should succeed with warning
  const cancelRes = await fetch(`${BASE}/work-orders/${wo2.id}/status`, {
    method: 'PATCH', headers: authHeaders,
    body: JSON.stringify({ status: 'cancelled' }),
  });
  const cancelData = (await cancelRes.json()).data;
  assert('Cancel returns 200', cancelRes.status === 200);
  assert('Status is cancelled', cancelData.workOrder.status === 'cancelled');
  assert('Warning about issued material', !!cancelData.warning);

  // 19. Cannot issue to cancelled WO
  console.log('\n19. Cannot issue to cancelled WO');
  const issueCanRes = await fetch(`${BASE}/work-orders/${wo2.id}/issue`, {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({
      lines: [{ woLineId: wo2line.id, quantity: 1, locationId: loc.id }],
    }),
  });
  assert('Issue to cancelled returns 400', issueCanRes.status === 400);

  // Summary
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
};

run().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
