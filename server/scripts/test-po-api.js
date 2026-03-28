/**
 * End-to-end test for Purchase Orders API.
 * Tests: create, get, list, update, send, receive (partial + full), cancel.
 * Uses timestamp suffix for unique test data across reruns.
 *
 * Prerequisites: server running on port 3000, seeded database with admin user.
 */

const BASE = 'http://localhost:3000/api/v1';
const suffix = Date.now().toString().slice(-6);
let TOKEN = '';
let passed = 0;
let failed = 0;

// We'll capture IDs as we go
let supplierId = '';
let itemId1 = '';
let itemId2 = '';
let locationId = '';
let poId = '';
let poLineId1 = '';
let poLineId2 = '';

const assert = (label, condition) => {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
};

const api = async (method, path, body = null) => {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (TOKEN) opts.headers.Authorization = `Bearer ${TOKEN}`;
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);
  const json = await res.json();
  return { status: res.status, ...json };
};

const run = async () => {
  console.log('\n=== Purchase Orders API Tests ===\n');

  // 1. Login
  console.log('1. Login');
  const login = await api('POST', '/auth/login', {
    email: 'admin@test.com',
    password: 'password123',
    tenantSlug: 'test-shop',
  });
  assert('Login succeeds', login.status === 200 && login.data.accessToken);
  TOKEN = login.data.accessToken;

  // 2. Create a supplier for our PO
  console.log('\n2. Create test supplier');
  const sup = await api('POST', '/suppliers', {
    name: `PO Test Supplier ${suffix}`,
    code: `PTS${suffix}`,
  });
  assert('Supplier created', sup.status === 201);
  supplierId = sup.data.id;

  // 3. Create two test items
  console.log('\n3. Create test items');
  const item1 = await api('POST', '/items', {
    partNumber: `PO-ITEM1-${suffix}`,
    description: 'PO test item 1',
    type: 'raw_material',
    unitOfMeasure: 'EA',
  });
  assert('Item 1 created', item1.status === 201);
  itemId1 = item1.data.id;

  const item2 = await api('POST', '/items', {
    partNumber: `PO-ITEM2-${suffix}`,
    description: 'PO test item 2',
    type: 'raw_material',
    unitOfMeasure: 'KG',
  });
  assert('Item 2 created', item2.status === 201);
  itemId2 = item2.data.id;

  // 4. Create a location for receiving
  console.log('\n4. Create test location');
  const loc = await api('POST', '/locations', {
    name: `PO Receiving ${suffix}`,
    code: `POREC${suffix}`,
    type: 'warehouse',
  });
  assert('Location created', loc.status === 201);
  locationId = loc.data.id;

  // 5. Create a PO
  console.log('\n5. Create PO');
  const createRes = await api('POST', '/purchase-orders', {
    supplierId,
    expectedDate: '2026-04-15',
    notes: 'Test purchase order',
    lines: [
      { itemId: itemId1, quantityOrdered: 100, unitCost: 5.50 },
      { itemId: itemId2, quantityOrdered: 50, unitCost: 12.00 },
    ],
  });
  assert('PO created (201)', createRes.status === 201);
  assert('PO has auto-generated number', createRes.data.poNumber?.startsWith('PO-'));
  assert('PO status is draft', createRes.data.status === 'draft');
  assert('PO has 2 lines', createRes.data.lines?.length === 2);
  poId = createRes.data.id;
  poLineId1 = createRes.data.lines?.find(l => l.itemId === itemId1)?.id;
  poLineId2 = createRes.data.lines?.find(l => l.itemId === itemId2)?.id;

  // 6. Get PO by ID
  console.log('\n6. Get PO by ID');
  const getRes = await api('GET', `/purchase-orders/${poId}`);
  assert('Get PO succeeds', getRes.status === 200);
  assert('Includes supplier details', !!getRes.data.supplier?.name);
  assert('Includes line item details', !!getRes.data.lines?.[0]?.item?.partNumber);

  // 7. List POs
  console.log('\n7. List POs');
  const listRes = await api('GET', '/purchase-orders');
  assert('List returns data', listRes.status === 200 && listRes.data.length > 0);
  assert('List has meta pagination', !!listRes.meta?.total);

  // 8. Update PO (draft only)
  console.log('\n8. Update PO');
  const updateRes = await api('PUT', `/purchase-orders/${poId}`, {
    notes: 'Updated test PO notes',
    lines: [
      { itemId: itemId1, quantityOrdered: 200, unitCost: 5.00 },
      { itemId: itemId2, quantityOrdered: 75, unitCost: 11.50 },
    ],
  });
  assert('Update succeeds', updateRes.status === 200);
  assert('Notes updated', updateRes.data.notes === 'Updated test PO notes');
  // Refresh line IDs after update (lines were replaced)
  poLineId1 = updateRes.data.lines?.find(l => l.itemId === itemId1)?.id;
  poLineId2 = updateRes.data.lines?.find(l => l.itemId === itemId2)?.id;

  // 9. Send PO
  console.log('\n9. Send PO');
  const sendRes = await api('PATCH', `/purchase-orders/${poId}/send`);
  assert('Send succeeds', sendRes.status === 200);
  assert('Status is now sent', sendRes.data.status === 'sent');

  // 10. Cannot edit sent PO
  console.log('\n10. Cannot edit sent PO');
  const editSent = await api('PUT', `/purchase-orders/${poId}`, { notes: 'should fail' });
  assert('Edit sent PO returns 400', editSent.status === 400);

  // 11. Partial receive
  console.log('\n11. Partial receive');
  const receiveRes1 = await api('POST', `/purchase-orders/${poId}/receive`, {
    lines: [
      { poLineId: poLineId1, quantity: 100, locationId },
    ],
  });
  assert('Partial receive succeeds (201)', receiveRes1.status === 201);
  assert('Status becomes partial', receiveRes1.data.newStatus === 'partial');

  // 12. Check inventory was created
  console.log('\n12. Verify inventory stock');
  const stockRes = await api('GET', `/inventory/stock?page=1&pageSize=100`);
  const poStock = stockRes.data?.find(s => s.itemId === itemId1);
  assert('Inventory stock created for received item', poStock && Number(poStock.quantityOnHand) === 100);

  // 13. Check inventory transaction was created
  console.log('\n13. Verify inventory transaction');
  const txRes = await api('GET', '/inventory/transactions?type=receipt&pageSize=100');
  const poTx = txRes.data?.find(t => t.referenceId === poId);
  assert('Receipt transaction created', !!poTx);
  assert('Transaction references PO', poTx?.referenceType === 'purchase_order');

  // 14. Full receive — receive remaining items
  console.log('\n14. Full receive');
  const receiveRes2 = await api('POST', `/purchase-orders/${poId}/receive`, {
    lines: [
      { poLineId: poLineId1, quantity: 100, locationId },
      { poLineId: poLineId2, quantity: 75, locationId },
    ],
  });
  assert('Full receive succeeds', receiveRes2.status === 201);
  assert('Status becomes received', receiveRes2.data.newStatus === 'received');

  // 15. Cannot receive on fully received PO
  console.log('\n15. Cannot receive on fully received PO');
  const overReceive = await api('POST', `/purchase-orders/${poId}/receive`, {
    lines: [{ poLineId: poLineId1, quantity: 1, locationId }],
  });
  assert('Over-receive rejected (400)', overReceive.status === 400);

  // 16. Create another PO and cancel it
  console.log('\n16. Create and cancel PO');
  const po2 = await api('POST', '/purchase-orders', {
    supplierId,
    lines: [{ itemId: itemId1, quantityOrdered: 10 }],
  });
  const cancelRes = await api('PATCH', `/purchase-orders/${po2.data.id}/cancel`);
  assert('Cancel draft PO succeeds', cancelRes.status === 200);
  assert('Status is cancelled', cancelRes.data.status === 'cancelled');

  // 17. Filter by status
  console.log('\n17. Filter by status');
  const filterRes = await api('GET', '/purchase-orders?status=received');
  assert('Filter by status works', filterRes.data?.every(po => po.status === 'received'));

  // Summary
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
};

run().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
