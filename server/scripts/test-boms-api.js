// Tests BOM CRUD API including lines, status transitions, tree, and revise.
// Requires the server running on port 3000 with seeded data.
// Run with: node scripts/test-boms-api.js

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

  // === Create test items (parent + components) ===
  console.log('\n=== Setup: Create Items ===');
  const createItem = async (partNumber, description, type) => {
    const res = await fetch(`${BASE}/items`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ partNumber, description, type, unitOfMeasure: 'ea' }),
    });
    const data = await res.json();
    return data.data;
  };

  const widgetA = await createItem('BOM-FG-001', 'Widget Assembly A', 'finished_good');
  const subAssy = await createItem('BOM-SA-001', 'Sub-Assembly X', 'sub_assembly');
  const rawSteel = await createItem('BOM-RM-001', 'Steel Rod 1/4"', 'raw_material');
  const rawBolt = await createItem('BOM-RM-002', 'Bolt M6x20', 'purchased_component');
  assert('Items created', !!widgetA && !!subAssy && !!rawSteel && !!rawBolt);

  // ============================================
  // BOM CRUD
  // ============================================
  console.log('\n=== Create BOM ===');

  // Create BOM for Widget A with 2 lines
  const createRes = await fetch(`${BASE}/boms`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      itemId: widgetA.id,
      revision: 'A',
      notes: 'Initial revision',
      lines: [
        { itemId: subAssy.id, quantity: 1, unitOfMeasure: 'ea', position: 1 },
        { itemId: rawBolt.id, quantity: 4, unitOfMeasure: 'ea', position: 2, scrapFactor: 0.05 },
      ],
    }),
  });
  const createData = await createRes.json();
  assert('Create BOM (201)', createRes.status === 201);
  assert('BOM has 2 lines', createData.data?.bomLines?.length === 2);
  assert('BOM status is draft', createData.data?.status === 'draft');
  assert('BOM includes item details', createData.data?.item?.partNumber === 'BOM-FG-001');
  const bomId = createData.data?.id;

  // Get by ID
  console.log('\n=== Get BOM ===');
  const getRes = await fetch(`${BASE}/boms/${bomId}`, { headers });
  const getData = await getRes.json();
  assert('Get BOM by ID', getData.data?.revision === 'A');
  assert('Lines include component item details', !!getData.data?.bomLines?.[0]?.item?.partNumber);

  // Update (change revision, replace lines)
  console.log('\n=== Update BOM ===');
  const updateRes = await fetch(`${BASE}/boms/${bomId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      revision: 'A1',
      lines: [
        { itemId: subAssy.id, quantity: 2, unitOfMeasure: 'ea', position: 1 },
        { itemId: rawBolt.id, quantity: 8, unitOfMeasure: 'ea', position: 2 },
        { itemId: rawSteel.id, quantity: 3, unitOfMeasure: 'ea', position: 3 },
      ],
    }),
  });
  const updateData = await updateRes.json();
  assert('Update BOM', updateData.data?.revision === 'A1');
  assert('Updated to 3 lines', updateData.data?.bomLines?.length === 3);

  // ============================================
  // STATUS TRANSITIONS
  // ============================================
  console.log('\n=== Status Transitions ===');

  // draft → active
  const activateRes = await fetch(`${BASE}/boms/${bomId}/status`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status: 'active' }),
  });
  const activateData = await activateRes.json();
  assert('Activate BOM (draft → active)', activateData.data?.status === 'active');

  // Can't edit active BOM
  const editActiveRes = await fetch(`${BASE}/boms/${bomId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ revision: 'B', lines: [{ itemId: rawSteel.id, quantity: 1, unitOfMeasure: 'ea' }] }),
  });
  assert('Cannot edit active BOM (400)', editActiveRes.status === 400);

  // Can't activate another BOM for same item
  const bom2Res = await fetch(`${BASE}/boms`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      itemId: widgetA.id,
      revision: 'B',
      lines: [{ itemId: rawSteel.id, quantity: 1, unitOfMeasure: 'ea' }],
    }),
  });
  const bom2Data = await bom2Res.json();
  const bom2Id = bom2Data.data?.id;

  const dupActiveRes = await fetch(`${BASE}/boms/${bom2Id}/status`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status: 'active' }),
  });
  assert('Cannot have 2 active BOMs for same item (409)', dupActiveRes.status === 409);

  // Invalid transition: active → draft
  const invalidRes = await fetch(`${BASE}/boms/${bomId}/status`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status: 'draft' }),
  });
  assert('Invalid transition active → draft (400)', invalidRes.status === 400);

  // ============================================
  // MULTI-LEVEL TREE
  // ============================================
  console.log('\n=== BOM Tree ===');

  // Create a child BOM for the sub-assembly
  const childBomRes = await fetch(`${BASE}/boms`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      itemId: subAssy.id,
      revision: 'A',
      lines: [
        { itemId: rawSteel.id, quantity: 2, unitOfMeasure: 'ea', position: 1 },
      ],
    }),
  });
  const childBomData = await childBomRes.json();
  const childBomId = childBomData.data?.id;

  // Activate the child BOM so tree can find it
  await fetch(`${BASE}/boms/${childBomId}/status`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status: 'active' }),
  });

  // Get tree for parent BOM
  const treeRes = await fetch(`${BASE}/boms/${bomId}/tree`, { headers });
  const treeData = await treeRes.json();
  assert('Tree has top-level lines', treeData.data?.tree?.length === 3);

  // The sub-assembly line should have children (the child BOM's lines)
  const subAssyNode = treeData.data?.tree?.find(n => n.itemId === subAssy.id);
  assert('Sub-assembly has children in tree', subAssyNode?.children?.length === 1);
  assert('Child is raw steel', subAssyNode?.children?.[0]?.item?.partNumber === 'BOM-RM-001');

  // ============================================
  // REVISE
  // ============================================
  console.log('\n=== Revise BOM ===');

  const reviseRes = await fetch(`${BASE}/boms/${bomId}/revise`, {
    method: 'POST',
    headers,
  });
  const reviseData = await reviseRes.json();
  assert('Revise creates new BOM (201)', reviseRes.status === 201);
  assert('New BOM is draft', reviseData.data?.status === 'draft');
  assert('New revision label', reviseData.data?.revision === 'A1-R');
  assert('Lines copied', reviseData.data?.bomLines?.length === 3);

  // Original should now be obsolete
  const origAfter = await fetch(`${BASE}/boms/${bomId}`, { headers });
  const origAfterData = await origAfter.json();
  assert('Original BOM is now obsolete', origAfterData.data?.status === 'obsolete');

  // List BOMs
  console.log('\n=== List BOMs ===');
  const listRes = await fetch(`${BASE}/boms?pageSize=100`, { headers });
  const listData = await listRes.json();
  assert('List returns multiple BOMs', listData.data?.length >= 3);

  // Filter by status
  const draftList = await fetch(`${BASE}/boms?status=draft`, { headers });
  const draftData = await draftList.json();
  assert('Filter by draft status works', draftData.data?.every(b => b.status === 'draft'));

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
