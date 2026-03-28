/**
 * Test CSV import for Items and Suppliers.
 * Tests: valid rows, invalid rows, duplicate handling.
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
  console.log('\n=== CSV Import Tests ===\n');

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

  // 2. Import items — mix of valid and invalid rows
  console.log('\n2. Import items CSV');
  const itemsCsv = [
    'partNumber,description,type,unitOfMeasure,trackingMethod',
    `CSV-ITEM1-${suffix},Test CSV Item 1,raw_material,EA,none`,
    `CSV-ITEM2-${suffix},Test CSV Item 2,finished_good,KG,lot`,
    `CSV-BAD-${suffix},,bad_type,EA,none`,  // missing description + invalid type
  ].join('\n');

  const itemForm = new FormData();
  itemForm.append('file', new Blob([itemsCsv], { type: 'text/csv' }), 'items.csv');

  const itemsRes = await fetch(`${BASE}/items/import`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}` },
    body: itemForm,
  });
  const itemsResult = await itemsRes.json();
  assert('Items import returns 200', itemsRes.status === 200);
  assert('Imported 2 valid items', itemsResult.data.imported === 2);
  assert('1 row had errors', itemsResult.data.errors?.length === 1);
  assert('Error is on row 4', itemsResult.data.errors?.[0]?.row === 4);

  // 3. Re-import same CSV — duplicates should be skipped
  console.log('\n3. Re-import same items (duplicate test)');
  const itemForm2 = new FormData();
  itemForm2.append('file', new Blob([itemsCsv], { type: 'text/csv' }), 'items.csv');
  const dupeRes = await fetch(`${BASE}/items/import`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}` },
    body: itemForm2,
  });
  const dupeResult = await dupeRes.json();
  assert('Duplicate import returns 200', dupeRes.status === 200);
  assert('0 new items imported (all duplicates)', dupeResult.data.imported === 0);
  assert('Skipped message present', dupeResult.data.skipped?.length > 0);

  // 4. Import suppliers
  console.log('\n4. Import suppliers CSV');
  const suppliersCsv = [
    'name,code,contactName,contactEmail',
    `CSV Supplier 1 ${suffix},CSVS1${suffix},John Doe,john@test.com`,
    `CSV Supplier 2 ${suffix},CSVS2${suffix},Jane Doe,jane@test.com`,
    `,CSVBAD${suffix},,`,  // missing required name
  ].join('\n');

  const supForm = new FormData();
  supForm.append('file', new Blob([suppliersCsv], { type: 'text/csv' }), 'suppliers.csv');

  const supRes = await fetch(`${BASE}/suppliers/import`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}` },
    body: supForm,
  });
  const supResult = await supRes.json();
  assert('Suppliers import returns 200', supRes.status === 200);
  assert('Imported 2 valid suppliers', supResult.data.imported === 2);
  assert('1 row had errors', supResult.data.errors?.length === 1);

  // 5. No file uploaded
  console.log('\n5. No file uploaded');
  const noFileRes = await fetch(`${BASE}/items/import`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}` },
  });
  assert('No file returns 400', noFileRes.status === 400);

  // Summary
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
};

run().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
