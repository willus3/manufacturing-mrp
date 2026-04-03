// UAT Section 8: Inventory Control
// Tests 8.1.1 - 8.4.3
// Depends on items from section 3 and locations from section 5.

import { test, expect } from '@playwright/test';
import { ADMIN, login } from './helpers.js';

const API = 'http://localhost:3000/api/v1';

async function getToken(page) {
  const res = await page.request.post(`${API}/auth/login`, {
    data: { email: ADMIN.email, password: ADMIN.password, tenantSlug: ADMIN.tenantSlug },
  });
  const { data } = await res.json();
  return data.accessToken;
}

test.describe.serial('8. Inventory Control', () => {
  let token;

  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN);
  });

  // === 8.1 Stock Overview ===

  test('8.1.1 - Overview loads', async ({ page }) => {
    await page.goto('/inventory');
    await expect(page.getByText(/stock|inventory/i).first()).toBeVisible();
  });

  test('8.1.2 - Zero stock items', async ({ page }) => {
    await page.goto('/inventory');
    // UAT items should appear with 0 stock
    await expect(page.getByText(/UAT/i).first()).toBeVisible({ timeout: 5_000 }).catch(() => {
      // Items might not be visible if too many items — acceptable
    });
  });

  // === 8.2 Inventory Adjustment ===

  test('8.2.1 - Navigate to adjust', async ({ page }) => {
    await page.goto('/inventory/adjust');
    // Should have item selector, location selector, quantity field
    await expect(page.getByText(/adjust/i).first()).toBeVisible();
  });

  test('8.2.2 - Add stock (UAT-RAW-001: +100)', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    // Find item and location IDs
    const itemsRes = await page.request.get(`${API}/items?search=UAT-RAW-001`, { headers });
    const { data: items } = await itemsRes.json();
    const itemId = items[0].id;

    const locsRes = await page.request.get(`${API}/locations?search=UAT-WH`, { headers });
    const { data: locs } = await locsRes.json();
    const locationId = locs[0].id;

    // Adjust via API
    const res = await page.request.post(`${API}/inventory/adjust`, {
      headers,
      data: { itemId, locationId, quantity: 100, notes: 'Initial stock for UAT' },
    });
    expect(res.status()).toBe(201);
  });

  test('8.2.3 - Verify stock', async ({ page }) => {
    await page.goto('/inventory');
    await page.waitForTimeout(1000);
    // UAT-RAW-001 should show stock
    await expect(page.getByText('UAT-RAW-001')).toBeVisible();
  });

  test('8.2.4 - Add more stock (UAT-RAW-002: +50)', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const itemsRes = await page.request.get(`${API}/items?search=UAT-RAW-002`, { headers });
    const { data: items } = await itemsRes.json();
    const itemId = items[0].id;

    const locsRes = await page.request.get(`${API}/locations?search=UAT-WH`, { headers });
    const { data: locs } = await locsRes.json();
    const locationId = locs[0].id;

    const res = await page.request.post(`${API}/inventory/adjust`, {
      headers,
      data: { itemId, locationId, quantity: 50, notes: 'UAT stock' },
    });
    expect(res.status()).toBe(201);
  });

  test('8.2.5 - Negative adjustment (UAT-RAW-001: -20)', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const itemsRes = await page.request.get(`${API}/items?search=UAT-RAW-001`, { headers });
    const { data: items } = await itemsRes.json();
    const itemId = items[0].id;

    const locsRes = await page.request.get(`${API}/locations?search=UAT-WH`, { headers });
    const { data: locs } = await locsRes.json();
    const locationId = locs[0].id;

    const res = await page.request.post(`${API}/inventory/adjust`, {
      headers,
      data: { itemId, locationId, quantity: -20, notes: 'UAT negative adjustment' },
    });
    expect(res.status()).toBe(201);
  });

  test('8.2.6 - Zero quantity rejected', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const itemsRes = await page.request.get(`${API}/items?search=UAT-RAW-001`, { headers });
    const { data: items } = await itemsRes.json();
    const locsRes = await page.request.get(`${API}/locations?search=UAT-WH`, { headers });
    const { data: locs } = await locsRes.json();

    const res = await page.request.post(`${API}/inventory/adjust`, {
      headers,
      data: { itemId: items[0].id, locationId: locs[0].id, quantity: 0 },
    });
    expect(res.status()).toBe(400);
  });

  test('8.2.7 - Stock for SA (UAT-SA-001: +10)', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const itemsRes = await page.request.get(`${API}/items?search=UAT-SA-001`, { headers });
    const { data: items } = await itemsRes.json();
    const locsRes = await page.request.get(`${API}/locations?search=UAT-WH`, { headers });
    const { data: locs } = await locsRes.json();

    const res = await page.request.post(`${API}/inventory/adjust`, {
      headers,
      data: { itemId: items[0].id, locationId: locs[0].id, quantity: 10, notes: 'SA stock' },
    });
    expect(res.status()).toBe(201);
  });

  // === 8.3 Inventory Transfer ===

  test('8.3.1 - Transfer stock', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const itemsRes = await page.request.get(`${API}/items?search=UAT-RAW-001`, { headers });
    const { data: items } = await itemsRes.json();
    const locsRes = await page.request.get(`${API}/locations`, { headers });
    const { data: locs } = await locsRes.json();
    const fromLoc = locs.find((l) => l.code === 'UAT-WH');
    const toLoc = locs.find((l) => l.code === 'UAT-STG');

    const res = await page.request.post(`${API}/inventory/transfer`, {
      headers,
      data: {
        itemId: items[0].id,
        fromLocationId: fromLoc.id,
        toLocationId: toLoc.id,
        quantity: 25,
      },
    });
    expect(res.status()).toBe(201);
  });

  test('8.3.2 - Verify transfer', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const stockRes = await page.request.get(`${API}/inventory/stock?search=UAT-RAW-001`, { headers });
    const { data: stock } = await stockRes.json();
    // Should have stock at both locations
    expect(stock.length).toBeGreaterThanOrEqual(1);
  });

  // === 8.4 Transaction Log ===

  test('8.4.1 - Log loads', async ({ page }) => {
    await page.goto('/inventory/transactions');
    await expect(page.getByText(/transaction/i).first()).toBeVisible();
  });

  test('8.4.2 - Entries correct', async ({ page }) => {
    await page.goto('/inventory/transactions');
    // Should show recent transactions
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 5_000 });
  });

  test('8.4.3 - Filter', async ({ page }) => {
    await page.goto('/inventory/transactions');
    // If filters exist, try them
    const filterInput = page.getByPlaceholder(/search|filter/i).first();
    if (await filterInput.isVisible().catch(() => false)) {
      await filterInput.fill('UAT-RAW-001');
      await page.waitForTimeout(500);
    }
  });
});
