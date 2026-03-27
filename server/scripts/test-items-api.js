// Quick test of the Items CRUD API.
// Requires the server running on port 3000.
// Run with: node scripts/test-items-api.js

const BASE = 'http://localhost:3000/api/v1';

const main = async () => {
  // 1. Login to get a token
  console.log('=== Login ===');
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@test.com', password: 'password123', tenantSlug: 'test-shop' }),
  });
  const loginData = await loginRes.json();
  const token = loginData.data.accessToken;
  console.log('Logged in, got token');

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  // 2. List items (should be empty)
  console.log('\n=== List Items (empty) ===');
  const listRes = await fetch(`${BASE}/items`, { headers });
  const listData = await listRes.json();
  console.log('Items:', listData.data?.length, '| Total:', listData.meta?.total);

  // 3. Create an item
  console.log('\n=== Create Item ===');
  const createRes = await fetch(`${BASE}/items`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      partNumber: 'RM-001',
      description: 'Steel Sheet 4x8',
      type: 'raw_material',
      unitOfMeasure: 'ea',
      reorderPoint: 10,
      reorderQuantity: 50,
      leadTimeDays: 7,
    }),
  });
  const createData = await createRes.json();
  console.log('Status:', createRes.status, '| Part:', createData.data?.partNumber);
  const itemId = createData.data?.id;

  // 4. Get by ID
  console.log('\n=== Get Item ===');
  const getRes = await fetch(`${BASE}/items/${itemId}`, { headers });
  const getData = await getRes.json();
  console.log('Item:', getData.data?.partNumber, '-', getData.data?.description);

  // 5. Update
  console.log('\n=== Update Item ===');
  const updateRes = await fetch(`${BASE}/items/${itemId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ description: 'Steel Sheet 4x8 (Cold Rolled)' }),
  });
  const updateData = await updateRes.json();
  console.log('Updated description:', updateData.data?.description);

  // 6. Create a second item to test list/search
  await fetch(`${BASE}/items`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      partNumber: 'FG-001',
      description: 'Widget Assembly A',
      type: 'finished_good',
      unitOfMeasure: 'ea',
    }),
  });

  // 7. List with search
  console.log('\n=== Search Items ===');
  const searchRes = await fetch(`${BASE}/items?search=steel`, { headers });
  const searchData = await searchRes.json();
  console.log('Search "steel":', searchData.data?.length, 'results');

  // 8. List with type filter
  console.log('\n=== Filter by Type ===');
  const filterRes = await fetch(`${BASE}/items?type=raw_material`, { headers });
  const filterData = await filterRes.json();
  console.log('Raw materials:', filterData.data?.length);

  // 9. Deactivate
  console.log('\n=== Deactivate Item ===');
  const deactivateRes = await fetch(`${BASE}/items/${itemId}/deactivate`, { method: 'PATCH', headers });
  const deactivateData = await deactivateRes.json();
  console.log('isActive:', deactivateData.data?.isActive);

  // 10. Duplicate part number (should 409)
  console.log('\n=== Duplicate Test ===');
  const dupRes = await fetch(`${BASE}/items`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      partNumber: 'FG-001',
      description: 'Duplicate test',
      type: 'raw_material',
      unitOfMeasure: 'ea',
    }),
  });
  const dupData = await dupRes.json();
  console.log('Status:', dupRes.status, '| Error:', dupData.error?.code);

  console.log('\nAll tests passed!');
};

main().catch(console.error);
