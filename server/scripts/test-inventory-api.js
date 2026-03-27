// Tests Inventory API: adjust, transfer, stock queries, transaction log.
// Requires the server running on port 3000 with seeded data.
// Run with: node scripts/test-inventory-api.js

const BASE = 'http://localhost:3000/api/v1';
let passed = 0;
let failed = 0;

const assert = (label, condition) => {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}`);
    failed++;
  }
};

const main = async () => {
  // === Login ===
  console.log('=== Login ===');
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@test.com', password: 'password123', tenantSlug: 'test-shop' }),
  });
  const loginData = await loginRes.json();
  const token = loginData.data.accessToken;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  assert('Login succeeded', !!token);

  // === Setup: Create an item and two locations ===
  console.log('\n=== Setup ===');
  const createItem = async (pn, desc, type) => {
    const r = await fetch(`${BASE}/items`, { method: 'POST', headers, body: JSON.stringify({ partNumber: pn, description: desc, type, unitOfMeasure: 'ea' }) });
    return (await r.json()).data;
  };
  const createLoc = async (name, code) => {
    const r = await fetch(`${BASE}/locations`, { method: 'POST', headers, body: JSON.stringify({ name, code }) });
    return (await r.json()).data;
  };

  const suffix = Date.now().toString().slice(-6);
  const item = await createItem(`INV-RM-${suffix}`, 'Test Raw Material', 'raw_material');
  const locA = await createLoc(`Warehouse Alpha ${suffix}`, `WH-A-${suffix}`);
  const locB = await createLoc(`Warehouse Beta ${suffix}`, `WH-B-${suffix}`);
  assert('Setup complete', !!item && !!locA && !!locB);

  // ============================================
  // ADJUST
  // ============================================
  console.log('\n=== Adjust (add stock) ===');
  const adjRes = await fetch(`${BASE}/inventory/adjust`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ itemId: item.id, locationId: locA.id, quantity: 100, notes: 'Initial stock' }),
  });
  const adjData = await adjRes.json();
  assert('Adjust returns 201', adjRes.status === 201);
  assert('Transaction type is adjustment', adjData.data?.transaction?.transactionType === 'adjustment');
  assert('Stock quantity is 100', Number(adjData.data?.stock?.quantityOnHand) === 100);

  // Adjust down
  console.log('\n=== Adjust (remove stock) ===');
  const adjDown = await fetch(`${BASE}/inventory/adjust`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ itemId: item.id, locationId: locA.id, quantity: -30, notes: 'Count correction' }),
  });
  const adjDownData = await adjDown.json();
  assert('Stock after removal is 70', Number(adjDownData.data?.stock?.quantityOnHand) === 70);

  // Insufficient stock
  console.log('\n=== Adjust (insufficient) ===');
  const adjBad = await fetch(`${BASE}/inventory/adjust`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ itemId: item.id, locationId: locA.id, quantity: -999 }),
  });
  assert('Insufficient stock returns 400', adjBad.status === 400);

  // ============================================
  // TRANSFER
  // ============================================
  console.log('\n=== Transfer ===');
  const xferRes = await fetch(`${BASE}/inventory/transfer`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ itemId: item.id, fromLocationId: locA.id, toLocationId: locB.id, quantity: 20 }),
  });
  const xferData = await xferRes.json();
  assert('Transfer returns 201', xferRes.status === 201);
  assert('Has out transaction', xferData.data?.outTransaction?.transactionType === 'transfer');
  assert('Has in transaction', xferData.data?.inTransaction?.transactionType === 'transfer');

  // Transfer to same location
  const xferSame = await fetch(`${BASE}/inventory/transfer`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ itemId: item.id, fromLocationId: locA.id, toLocationId: locA.id, quantity: 5 }),
  });
  assert('Same location transfer returns 400', xferSame.status === 400);

  // Insufficient transfer
  const xferBad = await fetch(`${BASE}/inventory/transfer`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ itemId: item.id, fromLocationId: locA.id, toLocationId: locB.id, quantity: 999 }),
  });
  assert('Insufficient transfer returns 400', xferBad.status === 400);

  // ============================================
  // STOCK QUERIES
  // ============================================
  console.log('\n=== Stock Queries ===');

  // List all stock
  const stockRes = await fetch(`${BASE}/inventory/stock`, { headers });
  const stockData = await stockRes.json();
  assert('Stock list returns records', stockData.data?.length >= 2);
  assert('Stock includes item details', !!stockData.data?.[0]?.item?.partNumber);

  // Filter by location
  const stockLocRes = await fetch(`${BASE}/inventory/stock?locationId=${locB.id}`, { headers });
  const stockLocData = await stockLocRes.json();
  assert('Filter stock by location', stockLocData.data?.length === 1);
  assert('Location B has 20', Number(stockLocData.data?.[0]?.quantityOnHand) === 20);

  // Summary
  const summRes = await fetch(`${BASE}/inventory/stock/summary`, { headers });
  const summData = await summRes.json();
  assert('Summary returns data', summData.data?.length >= 1);
  const itemSummary = summData.data?.find(s => s.item?.id === item.id);
  assert('Summary total is 70 (50 + 20)', Number(itemSummary?.totalOnHand) === 70);

  // ============================================
  // TRANSACTION LOG
  // ============================================
  console.log('\n=== Transaction Log ===');

  const txnRes = await fetch(`${BASE}/inventory/transactions`, { headers });
  const txnData = await txnRes.json();
  assert('Transaction log has entries', txnData.data?.length >= 4);
  assert('Transactions include user name', !!txnData.data?.[0]?.user?.firstName);

  // Filter by type
  const txnAdj = await fetch(`${BASE}/inventory/transactions?type=adjustment`, { headers });
  const txnAdjData = await txnAdj.json();
  assert('Filter by adjustment type', txnAdjData.data?.every(t => t.transactionType === 'adjustment'));

  // Filter by item
  const txnItem = await fetch(`${BASE}/inventory/transactions?itemId=${item.id}`, { headers });
  const txnItemData = await txnItem.json();
  assert('Filter by item', txnItemData.data?.every(t => t.itemId === item.id));

  // ============================================
  // SUMMARY
  // ============================================
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
};

main().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
