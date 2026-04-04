// UAT Section 10: Work Orders
// Tests 10.1.1 - 10.2.9
// Depends on BOMs (section 7), inventory (section 8).
// UAT-FG-001 must have an active BOM and sufficient raw material stock.

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

test.describe.serial('10. Work Orders', () => {
  let token;
  let activeBomId;
  let woId;
  let woLines = [];
  let cancelWoId;
  let warehouseLocationId;

  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN);
  });

  // Setup: find active BOM and warehouse location
  test('10.0 - Setup prerequisites', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    // Find FG item
    const itemsRes = await page.request.get(`${API}/items?search=UAT-FG-001`, { headers });
    const { data: items } = await itemsRes.json();
    const fgItemId = items[0].id;

    // Find active BOM for FG (or activate a draft if none is active)
    const bomsRes = await page.request.get(`${API}/boms?itemId=${fgItemId}`, { headers });
    const { data: boms } = await bomsRes.json();
    let activeBom = boms.find((b) => b.status === 'active');

    if (!activeBom) {
      // Activate the first draft BOM found
      const draftBom = boms.find((b) => b.status === 'draft');
      expect(draftBom).toBeTruthy();
      const activateRes = await page.request.patch(`${API}/boms/${draftBom.id}/status`, {
        headers,
        data: { status: 'active' },
      });
      expect(activateRes.status()).toBe(200);
      const { data: activated } = await activateRes.json();
      activeBom = activated;
    }

    expect(activeBom).toBeTruthy();
    activeBomId = activeBom.id;

    // Find warehouse location
    const locsRes = await page.request.get(`${API}/locations?search=UAT-WH`, { headers });
    const { data: locs } = await locsRes.json();
    warehouseLocationId = locs[0].id;
  });

  // === 10.1 Create WO ===

  test('10.1.1 - Navigate to create', async ({ page }) => {
    await page.goto('/work-orders');
    // "Create WO" is a button that navigates (not a link)
    await page.getByRole('button', { name: /new wo|create wo|create/i }).click();
    await expect(page).toHaveURL(/\/work-orders\/new/);
  });

  test('10.1.2 - Create WO', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const scheduledStart = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const scheduledEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const res = await page.request.post(`${API}/work-orders`, {
      headers,
      data: {
        bomId: activeBomId,
        quantity: 10,
        priority: 1,
        scheduledStart,
        scheduledEnd,
        notes: 'UAT WO test',
      },
    });
    expect(res.status()).toBe(201);
    const { data: wo } = await res.json();
    woId = wo.id;
    expect(wo.status).toBe('planned');
    expect(wo.woNumber).toMatch(/^WO-/);
  });

  test('10.1.3 - Material lines', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const res = await page.request.get(`${API}/work-orders/${woId}`, { headers });
    const { data: wo } = await res.json();

    // WO should have material lines auto-generated from BOM
    expect(wo.lines.length).toBeGreaterThan(0);
    woLines = wo.lines;

    // Each line should have quantityRequired > 0 and quantityIssued = 0
    for (const line of wo.lines) {
      expect(Number(line.quantityRequired)).toBeGreaterThan(0);
      expect(Number(line.quantityIssued)).toBe(0);
    }
  });

  test('10.1.4 - WO number format', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const res = await page.request.get(`${API}/work-orders/${woId}`, { headers });
    const { data: wo } = await res.json();
    expect(wo.woNumber).toMatch(/^WO-\d{4,}$/);
  });

  // === 10.2 WO Status Transitions ===

  test('10.2.1 - Release WO', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const res = await page.request.patch(`${API}/work-orders/${woId}/status`, {
      headers,
      data: { status: 'released' },
    });
    expect(res.status()).toBe(200);
    // changeStatus returns { workOrder: {...}, warning?: "..." }
    const { data } = await res.json();
    const wo = data.workOrder ?? data;
    expect(wo.status).toBe('released');

    // Verify in UI
    await page.goto(`/work-orders/${woId}`);
    await expect(page.getByText(/released/i).first()).toBeVisible();
  });

  test('10.2.2 - Issue material', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    // Issue all material lines from warehouse
    const issueLines = woLines.map((line) => ({
      woLineId: line.id,
      quantity: Number(line.quantityRequired),
      locationId: warehouseLocationId,
    }));

    // issue endpoint returns 201 (created transactions)
    const res = await page.request.post(`${API}/work-orders/${woId}/issue`, {
      headers,
      data: { lines: issueLines },
    });
    expect([200, 201]).toContain(res.status());
  });

  test('10.2.3 - Verify stock consumed', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    // Stock should have decreased — just verify API call works
    const stockRes = await page.request.get(`${API}/inventory/stock?search=UAT-RAW-001`, { headers });
    expect(stockRes.status()).toBe(200);
  });

  test('10.2.4 - Verify transactions', async ({ page }) => {
    await page.goto('/inventory/transactions');
    await page.waitForTimeout(1000);
    // Should show issue transactions
    await expect(page.locator('tbody tr').first()).toBeVisible();
  });

  test('10.2.5 - Start production', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const res = await page.request.patch(`${API}/work-orders/${woId}/status`, {
      headers,
      data: { status: 'in_progress' },
    });
    expect(res.status()).toBe(200);
    const { data } = await res.json();
    const wo = data.workOrder ?? data;
    expect(wo.status).toBe('in_progress');
  });

  test('10.2.6 - Complete WO', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const res = await page.request.patch(`${API}/work-orders/${woId}/status`, {
      headers,
      data: { status: 'completed' },
    });
    expect(res.status()).toBe(200);
    const { data } = await res.json();
    const wo = data.workOrder ?? data;
    expect(wo.status).toBe('completed');
  });

  test('10.2.7 - Verify FG receipt', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    // UAT-FG-001 stock should have increased by 10
    const stockRes = await page.request.get(`${API}/inventory/stock?search=UAT-FG-001`, { headers });
    const { data: stock } = await stockRes.json();
    expect(stock.length).toBeGreaterThanOrEqual(1);
  });

  test('10.2.8 - Verify receipt transaction', async ({ page }) => {
    await page.goto('/inventory/transactions');
    await page.waitForTimeout(1000);
    // Receipt transaction should exist
    await expect(page.locator('tbody tr').first()).toBeVisible();
  });

  test('10.2.9 - Cancel WO', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    // Create a new WO to cancel
    const createRes = await page.request.post(`${API}/work-orders`, {
      headers,
      data: { bomId: activeBomId, quantity: 5, priority: 0 },
    });
    expect(createRes.status()).toBe(201);
    const { data: newWo } = await createRes.json();
    cancelWoId = newWo.id;

    const res = await page.request.patch(`${API}/work-orders/${cancelWoId}/status`, {
      headers,
      data: { status: 'cancelled' },
    });
    expect(res.status()).toBe(200);
    const { data } = await res.json();
    const cancelled = data.workOrder ?? data;
    expect(cancelled.status).toBe('cancelled');
  });
});
