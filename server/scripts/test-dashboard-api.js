/**
 * Dashboard API Test Script
 * Tests: Dashboard summary endpoint returns all expected card data.
 *
 * Prerequisites: Server running on port 3000, database seeded with sample data.
 */
require('dotenv').config();
const BASE = 'http://localhost:3000/api/v1';

let token = '';
let passed = 0;
let failed = 0;

// --- Helpers ---

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

const assert = (condition, label) => {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}`);
    failed++;
  }
};

const run = async () => {
  console.log('=== Dashboard API Tests ===\n');

  // 1. Login
  console.log('1. Login');
  const login = await api('POST', '/auth/login', {
    email: 'admin@test.com',
    password: 'password123',
    tenantSlug: 'test-shop',
  });
  assert(login.status === 200, 'Login succeeds');
  token = login.data.accessToken;

  // 2. Get dashboard summary
  console.log('\n2. Get dashboard summary');
  let res = await api('GET', '/dashboard');
  assert(res.status === 200, 'GET /dashboard returns 200');
  assert(res.data !== null, 'Returns data object');

  const d = res.data;

  // 3. Verify low stock alerts structure
  console.log('\n3. Low stock alerts');
  assert(d.lowStockAlerts !== undefined, 'Has lowStockAlerts field');
  assert(typeof d.lowStockAlerts.count === 'number', 'lowStockAlerts.count is a number');
  assert(Array.isArray(d.lowStockAlerts.items), 'lowStockAlerts.items is an array');
  if (d.lowStockAlerts.items.length > 0) {
    const item = d.lowStockAlerts.items[0];
    assert(item.partNumber, 'Low stock item has partNumber');
    assert(item.availableQty !== undefined, 'Low stock item has availableQty');
    assert(item.reorderPoint !== undefined, 'Low stock item has reorderPoint');
    assert(item.shortfall !== undefined, 'Low stock item has shortfall');
  }

  // 4. Verify purchase orders structure
  console.log('\n4. Purchase orders');
  assert(d.purchaseOrders !== undefined, 'Has purchaseOrders field');
  assert(typeof d.purchaseOrders.draft === 'number', 'Has draft count');
  assert(typeof d.purchaseOrders.sent === 'number', 'Has sent count');
  assert(typeof d.purchaseOrders.partial === 'number', 'Has partial count');
  assert(typeof d.purchaseOrders.received === 'number', 'Has received count');
  assert(typeof d.purchaseOrders.overdue === 'number', 'Has overdue count');

  // 5. Verify work orders structure
  console.log('\n5. Work orders');
  assert(d.workOrders !== undefined, 'Has workOrders field');
  assert(typeof d.workOrders.planned === 'number', 'Has planned count');
  assert(typeof d.workOrders.released === 'number', 'Has released count');
  assert(typeof d.workOrders.in_progress === 'number', 'Has in_progress count');
  assert(typeof d.workOrders.completed === 'number', 'Has completed count');

  // 6. Verify open demand
  console.log('\n6. Open demand');
  assert(typeof d.openDemand === 'number', 'openDemand is a number');
  // Seed data creates 3 open demand entries
  assert(d.openDemand >= 0, 'openDemand is non-negative');

  // 7. Verify last MRP run
  console.log('\n7. Last MRP run');
  // lastMrpRun may be null if no MRP has been run yet — both are valid
  if (d.lastMrpRun) {
    assert(d.lastMrpRun.id, 'Last MRP run has id');
    assert(d.lastMrpRun.ranAt, 'Last MRP run has ranAt');
    assert(d.lastMrpRun.status, 'Last MRP run has status');
    assert(typeof d.lastMrpRun.unconvertedSuggestions === 'number', 'Has unconvertedSuggestions count');
  } else {
    assert(d.lastMrpRun === null, 'No MRP runs yet (null is valid)');
  }

  // 8. Unauthenticated request
  console.log('\n8. Authorization check');
  const savedToken = token;
  token = '';
  res = await api('GET', '/dashboard');
  assert(res.status === 401, 'Unauthenticated request returns 401');
  token = savedToken;

  // --- Summary ---
  console.log(`\n=== Results: ${passed} passed, ${failed} failed (${passed + failed} total) ===`);
  process.exit(failed > 0 ? 1 : 0);
};

run().catch((err) => {
  console.error('Test script crashed:', err);
  process.exit(1);
});
