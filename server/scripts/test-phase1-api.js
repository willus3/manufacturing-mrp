// Tests Suppliers, Locations, and Item-Supplier Links APIs.
// Requires the server running on port 3000 with seeded data.
// Run with: node scripts/test-phase1-api.js

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

  // ============================================
  // SUPPLIERS
  // ============================================
  console.log('\n=== Suppliers ===');

  // List (empty)
  const listEmpty = await fetch(`${BASE}/suppliers`, { headers });
  const listEmptyData = await listEmpty.json();
  assert('List suppliers (empty)', listEmptyData.data?.length === 0);

  // Create
  const createRes = await fetch(`${BASE}/suppliers`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Acme Steel',
      code: 'ACME',
      contactName: 'John Doe',
      contactEmail: 'john@acme.com',
    }),
  });
  const createData = await createRes.json();
  assert('Create supplier (201)', createRes.status === 201);
  assert('Supplier has name', createData.data?.name === 'Acme Steel');
  const supplierId = createData.data?.id;

  // Create second supplier
  const create2 = await fetch(`${BASE}/suppliers`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'Bolt Depot', code: 'BOLT' }),
  });
  const create2Data = await create2.json();
  const supplier2Id = create2Data.data?.id;

  // Get by ID
  const getRes = await fetch(`${BASE}/suppliers/${supplierId}`, { headers });
  const getData = await getRes.json();
  assert('Get supplier by ID', getData.data?.code === 'ACME');

  // Update
  const updateRes = await fetch(`${BASE}/suppliers/${supplierId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ contactPhone: '555-1234' }),
  });
  const updateData = await updateRes.json();
  assert('Update supplier', updateData.data?.contactPhone === '555-1234');

  // Search
  const searchRes = await fetch(`${BASE}/suppliers?search=bolt`, { headers });
  const searchData = await searchRes.json();
  assert('Search suppliers', searchData.data?.length === 1);

  // Duplicate code (409)
  const dupRes = await fetch(`${BASE}/suppliers`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'Duplicate Test', code: 'ACME' }),
  });
  assert('Duplicate code returns 409', dupRes.status === 409);

  // Deactivate
  const deactRes = await fetch(`${BASE}/suppliers/${supplier2Id}/deactivate`, { method: 'PATCH', headers });
  const deactData = await deactRes.json();
  assert('Deactivate supplier', deactData.data?.isActive === false);

  // ============================================
  // LOCATIONS
  // ============================================
  console.log('\n=== Locations ===');

  // List (empty)
  const locListEmpty = await fetch(`${BASE}/locations`, { headers });
  const locListEmptyData = await locListEmpty.json();
  assert('List locations (empty)', locListEmptyData.data?.length === 0);

  // Create
  const locCreate = await fetch(`${BASE}/locations`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'Warehouse A', code: 'WH-A', description: 'Main warehouse' }),
  });
  const locCreateData = await locCreate.json();
  assert('Create location (201)', locCreate.status === 201);
  assert('Location has code', locCreateData.data?.code === 'WH-A');
  const locationId = locCreateData.data?.id;

  // Create second location
  await fetch(`${BASE}/locations`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'Receiving Dock', code: 'RECV' }),
  });

  // Get by ID
  const locGet = await fetch(`${BASE}/locations/${locationId}`, { headers });
  const locGetData = await locGet.json();
  assert('Get location by ID', locGetData.data?.name === 'Warehouse A');

  // Update
  const locUpdate = await fetch(`${BASE}/locations/${locationId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ description: 'Main warehouse - updated' }),
  });
  const locUpdateData = await locUpdate.json();
  assert('Update location', locUpdateData.data?.description === 'Main warehouse - updated');

  // Search
  const locSearch = await fetch(`${BASE}/locations?search=dock`, { headers });
  const locSearchData = await locSearch.json();
  assert('Search locations', locSearchData.data?.length === 1);

  // Duplicate code (409)
  const locDup = await fetch(`${BASE}/locations`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'Dup Test', code: 'WH-A' }),
  });
  assert('Duplicate location code returns 409', locDup.status === 409);

  // Deactivate (should succeed — no stock)
  const locDeact = await fetch(`${BASE}/locations/${locationId}/deactivate`, { method: 'PATCH', headers });
  const locDeactData = await locDeact.json();
  assert('Deactivate location', locDeactData.data?.isActive === false);

  // ============================================
  // ITEM-SUPPLIER LINKS
  // ============================================
  console.log('\n=== Item-Supplier Links ===');

  // We need an item — grab the first one from earlier tests
  const itemsRes = await fetch(`${BASE}/items?pageSize=1`, { headers });
  const itemsData = await itemsRes.json();
  const itemId = itemsData.data?.[0]?.id;
  assert('Have an item to link', !!itemId);

  // List (empty)
  const linkListEmpty = await fetch(`${BASE}/items/${itemId}/suppliers`, { headers });
  const linkListEmptyData = await linkListEmpty.json();
  assert('List item-suppliers (empty)', linkListEmptyData.data?.length === 0);

  // Create link
  const linkCreate = await fetch(`${BASE}/items/${itemId}/suppliers`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      supplierId,
      supplierPartNumber: 'ACME-SS-48',
      unitCost: 25.50,
      leadTimeDays: 5,
      isPreferred: true,
    }),
  });
  const linkCreateData = await linkCreate.json();
  assert('Create item-supplier link (201)', linkCreate.status === 201);
  assert('Link includes supplier name', linkCreateData.data?.supplier?.name === 'Acme Steel');

  // Update link
  const linkUpdate = await fetch(`${BASE}/items/${itemId}/suppliers/${supplierId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ unitCost: 23.00, minOrderQuantity: 10 }),
  });
  const linkUpdateData = await linkUpdate.json();
  assert('Update item-supplier link', Number(linkUpdateData.data?.unitCost) === 23);

  // Duplicate link (409)
  const linkDup = await fetch(`${BASE}/items/${itemId}/suppliers`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ supplierId }),
  });
  assert('Duplicate item-supplier link returns 409', linkDup.status === 409);

  // List (should have 1)
  const linkList = await fetch(`${BASE}/items/${itemId}/suppliers`, { headers });
  const linkListData = await linkList.json();
  assert('List item-suppliers (1 link)', linkListData.data?.length === 1);

  // Delete link
  const linkDelete = await fetch(`${BASE}/items/${itemId}/suppliers/${supplierId}`, {
    method: 'DELETE',
    headers,
  });
  assert('Delete item-supplier link (200)', linkDelete.status === 200);

  // Verify deleted
  const linkListAfter = await fetch(`${BASE}/items/${itemId}/suppliers`, { headers });
  const linkListAfterData = await linkListAfter.json();
  assert('Link removed', linkListAfterData.data?.length === 0);

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
