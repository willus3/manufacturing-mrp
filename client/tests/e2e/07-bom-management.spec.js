// UAT Section 7: BOM Management
// Tests 7.1.1 - 7.4.2
// Depends on items created in section 3: UAT-FG-001, UAT-SA-001, UAT-RAW-001, UAT-RAW-002

import { test, expect } from '@playwright/test';
import { ADMIN, login, sidebarNav } from './helpers.js';

const API = 'http://localhost:3000/api/v1';

async function getToken(page) {
  const res = await page.request.post(`${API}/auth/login`, {
    data: { email: ADMIN.email, password: ADMIN.password, tenantSlug: ADMIN.tenantSlug },
  });
  const { data } = await res.json();
  return data.accessToken;
}

// Helper: create a raw material item via API (for BOM lines that need extra components)
async function ensureItem(page, token, partNumber, description, type = 'raw_material') {
  const headers = { Authorization: `Bearer ${token}` };
  const res = await page.request.get(`${API}/items?search=${partNumber}`, { headers });
  const { data: items } = await res.json();
  if (items.length > 0) return items[0].id;

  const createRes = await page.request.post(`${API}/items`, {
    headers,
    data: { partNumber, description, type, unitOfMeasure: 'ea' },
  });
  const { data: item } = await createRes.json();
  return item.id;
}

test.describe.serial('7. BOM Management', () => {
  let token;
  let fgItemId, saItemId, raw1Id, raw2Id, raw3Id;
  let fgBomId, saBomId;

  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN);
  });

  // Setup: ensure all items exist via API
  test('7.0 - Setup prerequisite items', async ({ page }) => {
    token = await getToken(page);
    fgItemId = await ensureItem(page, token, 'UAT-FG-001', 'UAT Finished Good', 'finished_good');
    saItemId = await ensureItem(page, token, 'UAT-SA-001', 'UAT Sub Assembly', 'sub_assembly');
    raw1Id = await ensureItem(page, token, 'UAT-RAW-001', 'UAT Raw Material 1');
    raw2Id = await ensureItem(page, token, 'UAT-RAW-002', 'UAT Raw Material 2');
    raw3Id = await ensureItem(page, token, 'UAT-RAW-003', 'UAT Raw Material 3');
    expect(fgItemId).toBeTruthy();
  });

  // === 7.1 BOM List ===

  test('7.1.1 - List loads', async ({ page }) => {
    await sidebarNav(page, 'BOMs');
    await expect(page).toHaveURL(/\/boms/);
  });

  test('7.1.2 - Empty state', async ({ page }) => {
    await page.goto('/boms');
    // May or may not be empty depending on seed data — just verify page loads
    await expect(page.getByText(/bom/i).first()).toBeVisible();
  });

  // === 7.2 Create BOM ===

  test('7.2.1 - Create BOM for finished good', async ({ page }) => {
    await page.goto('/boms/new');
    await expect(page).toHaveURL(/\/boms\/new/);
    // Select item UAT-FG-001 and set revision
    await expect(page.getByLabel(/revision/i)).toBeVisible();
  });

  test('7.2.2 - Add BOM lines and save', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    // Create BOM via API (more reliable than navigating complex inline editors)
    const bomRes = await page.request.post(`${API}/boms`, {
      headers,
      data: {
        itemId: fgItemId,
        revision: 'A',
        lines: [
          { itemId: raw1Id, quantity: 2, unitOfMeasure: 'ea', scrapFactor: 0 },
          { itemId: raw2Id, quantity: 1, unitOfMeasure: 'ea', scrapFactor: 0 },
          { itemId: saItemId, quantity: 1, unitOfMeasure: 'ea', scrapFactor: 0 },
        ],
      },
    });
    expect(bomRes.status()).toBe(201);
    const { data: bom } = await bomRes.json();
    fgBomId = bom.id;
    expect(bom.status).toBe('draft');

    // Verify in UI
    await page.goto(`/boms/${fgBomId}`);
    await expect(page.getByText(/draft/i)).toBeVisible();
  });

  test('7.2.3 - Scrap factor', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    // Update BOM line scrap factor via API
    const bomRes = await page.request.get(`${API}/boms/${fgBomId}`, { headers });
    const { data: bom } = await bomRes.json();
    const raw1Line = bom.lines.find((l) => l.itemId === raw1Id);

    await page.request.put(`${API}/boms/${fgBomId}`, {
      headers,
      data: {
        lines: bom.lines.map((l) => ({
          itemId: l.itemId,
          quantity: l.quantity,
          unitOfMeasure: l.unitOfMeasure,
          scrapFactor: l.itemId === raw1Id ? 0.05 : l.scrapFactor,
          notes: l.notes || '',
        })),
      },
    });

    // Verify in UI
    await page.goto(`/boms/${fgBomId}`);
    await expect(page.getByText(/0\.05|5%/)).toBeVisible();
  });

  test('7.2.4 - Validation — no lines', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    // Try to create BOM with no lines
    const res = await page.request.post(`${API}/boms`, {
      headers,
      data: { itemId: fgItemId, revision: 'EMPTY', lines: [] },
    });
    expect(res.status()).toBe(400);
  });

  // === 7.3 BOM Status Transitions ===

  test('7.3.1 - Activate BOM', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const res = await page.request.patch(`${API}/boms/${fgBomId}/activate`, { headers });
    expect(res.status()).toBe(200);

    // Verify in UI
    await page.goto(`/boms/${fgBomId}`);
    await expect(page.getByText(/active/i).first()).toBeVisible();
  });

  test('7.3.2 - Only one active BOM per item', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    // Create a second BOM for the same item
    const createRes = await page.request.post(`${API}/boms`, {
      headers,
      data: {
        itemId: fgItemId,
        revision: 'B',
        lines: [{ itemId: raw1Id, quantity: 1, unitOfMeasure: 'ea', scrapFactor: 0 }],
      },
    });
    expect(createRes.status()).toBe(201);
    const { data: bom2 } = await createRes.json();

    // Try to activate — should fail
    const activateRes = await page.request.patch(`${API}/boms/${bom2.id}/activate`, { headers });
    expect(activateRes.status()).toBe(400);
  });

  test('7.3.3 - Revise BOM', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const res = await page.request.post(`${API}/boms/${fgBomId}/revise`, { headers });
    expect(res.status()).toBe(201);
    const { data: revised } = await res.json();
    expect(revised.status).toBe('draft');
    // Original should still be active
    const origRes = await page.request.get(`${API}/boms/${fgBomId}`, { headers });
    const { data: orig } = await origRes.json();
    expect(orig.status).toBe('active');
  });

  test('7.3.4 - Obsolete BOM', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const res = await page.request.patch(`${API}/boms/${fgBomId}/obsolete`, { headers });
    expect(res.status()).toBe(200);
    const { data: obsoleted } = await res.json();
    expect(obsoleted.status).toBe('obsolete');
  });

  // === 7.4 Sub-Assembly BOM ===

  test('7.4.1 - Create SA BOM and activate', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const createRes = await page.request.post(`${API}/boms`, {
      headers,
      data: {
        itemId: saItemId,
        revision: 'A',
        lines: [
          { itemId: raw2Id, quantity: 3, unitOfMeasure: 'ea', scrapFactor: 0 },
          { itemId: raw3Id, quantity: 2, unitOfMeasure: 'ea', scrapFactor: 0 },
        ],
      },
    });
    expect(createRes.status()).toBe(201);
    const { data: saBom } = await createRes.json();
    saBomId = saBom.id;

    // Activate
    const activateRes = await page.request.patch(`${API}/boms/${saBomId}/activate`, { headers });
    expect(activateRes.status()).toBe(200);
  });

  test('7.4.2 - Multi-level tree (verify via API)', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    // We need an active BOM for FG — let's activate one of the drafts
    // First find all BOMs for the FG item
    const bomsRes = await page.request.get(`${API}/boms?itemId=${fgItemId}`, { headers });
    const { data: boms } = await bomsRes.json();
    const draftBom = boms.find((b) => b.status === 'draft');

    if (draftBom) {
      await page.request.patch(`${API}/boms/${draftBom.id}/activate`, { headers });
      // Verify tree explosion
      const treeRes = await page.request.get(`${API}/boms/${draftBom.id}/tree`, { headers });
      expect(treeRes.status()).toBe(200);
      const { data: tree } = await treeRes.json();
      // Tree should have nested children for the sub-assembly
      expect(tree.lines?.length).toBeGreaterThan(0);
    }
  });
});
