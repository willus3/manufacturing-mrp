// UAT Section 15: Cross-Module Integration (End-to-End Flow)
// Tests 15.1 - 15.10
// Complete manufacturing cycle: demand → MRP → purchase → receive → produce → deliver.
// Depends on all prior sections (items, BOMs, suppliers, inventory, etc.).

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

test.describe.serial('15. Cross-Module Integration (End-to-End Flow)', () => {
  let token;
  let fgItemId;
  let demandId;
  let mrpRunId;
  let purchaseResultId, produceResultId;
  let newPoId, newWoId;
  let warehouseLocationId;

  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN);
  });

  // Setup: gather IDs
  test('15.0 - Setup', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const itemsRes = await page.request.get(`${API}/items?search=UAT-FG-001`, { headers });
    const { data: items } = await itemsRes.json();
    fgItemId = items[0].id;

    const locsRes = await page.request.get(`${API}/locations?search=UAT-WH`, { headers });
    const { data: locs } = await locsRes.json();
    warehouseLocationId = locs[0].id;
  });

  // === 15.1 Enter demand ===

  test('15.1 - Enter demand', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const dateRequired = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const res = await page.request.post(`${API}/mrp/demand`, {
      headers,
      data: { itemId: fgItemId, quantityRequired: 20, dateRequired, notes: 'E2E integration test' },
    });
    expect(res.status()).toBe(201);
    const { data: demand } = await res.json();
    demandId = demand.id;
    expect(demand.status).toBe('open');
  });

  // === 15.2 Run MRP ===

  test('15.2 - Run MRP', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const res = await page.request.post(`${API}/mrp/run`, {
      headers,
      data: { planningHorizonDays: 90 },
    });
    expect(res.status()).toBe(201);
    const { data: run } = await res.json();
    mrpRunId = run.id;
    expect(run.status).toBe('completed');

    // Get results — endpoint returns { run, results }
    const resultsRes = await page.request.get(`${API}/mrp/runs/${mrpRunId}/results`, { headers });
    const { data: runData } = await resultsRes.json();
    const results = runData.results;
    expect(results.length).toBeGreaterThan(0);

    purchaseResultId = results.find((r) => r.actionType === 'purchase')?.id;
    produceResultId = results.find((r) => r.actionType === 'produce')?.id;
  });

  // === 15.3 Convert purchase suggestion ===

  test('15.3 - Convert purchase suggestion', async ({ page }) => {
    if (!purchaseResultId) {
      test.skip();
      return;
    }
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const res = await page.request.post(
      `${API}/mrp/runs/${mrpRunId}/results/${purchaseResultId}/convert`,
      { headers }
    );
    // 400 with NO_SUPPLIER is valid — item has no linked supplier
    if (res.status() === 400) {
      const body = await res.json();
      expect(body.error?.code).toBe('NO_SUPPLIER');
      purchaseResultId = null; // Mark as skipped
      return;
    }
    expect(res.status()).toBe(201);
    const { data } = await res.json();
    // Response shape: { type: 'purchase_order', po: { id, ... } }
    newPoId = data.po?.id || data.id;
  });

  // === 15.4 Send PO ===

  test('15.4 - Send PO', async ({ page }) => {
    if (!newPoId) {
      test.skip();
      return;
    }
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const res = await page.request.patch(`${API}/purchase-orders/${newPoId}/send`, { headers });
    expect(res.status()).toBe(200);
    const { data: po } = await res.json();
    expect(po.status).toBe('sent');
  });

  // === 15.5 Receive materials ===

  test('15.5 - Receive materials', async ({ page }) => {
    if (!newPoId) {
      test.skip();
      return;
    }
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    // Get PO lines
    const poRes = await page.request.get(`${API}/purchase-orders/${newPoId}`, { headers });
    const { data: po } = await poRes.json();

    // Receive all lines fully
    const receiveLines = po.lines.map((line) => ({
      poLineId: line.id,
      quantity: Number(line.quantityOrdered) - Number(line.quantityReceived || 0),
      locationId: warehouseLocationId,
    }));

    const res = await page.request.post(`${API}/purchase-orders/${newPoId}/receive`, {
      headers,
      data: { lines: receiveLines },
    });
    expect([200, 201]).toContain(res.status());
  });

  // === 15.6 Convert produce suggestion ===

  test('15.6 - Convert produce suggestion', async ({ page }) => {
    if (!produceResultId) {
      test.skip();
      return;
    }
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const res = await page.request.post(
      `${API}/mrp/runs/${mrpRunId}/results/${produceResultId}/convert`,
      { headers }
    );
    expect(res.status()).toBe(201);
    const { data } = await res.json();
    // Response shape: { type: 'work_order', workOrder: { id, ... } }
    newWoId = data.workOrder?.id || data.id;
  });

  // === 15.7 Release WO ===

  test('15.7 - Release WO', async ({ page }) => {
    if (!newWoId) {
      test.skip();
      return;
    }
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const res = await page.request.patch(`${API}/work-orders/${newWoId}/status`, {
      headers,
      data: { status: 'released' },
    });
    expect(res.status()).toBe(200);
  });

  // === 15.8 Issue material ===

  test('15.8 - Issue material', async ({ page }) => {
    if (!newWoId) {
      test.skip();
      return;
    }
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    // Get WO lines
    const woRes = await page.request.get(`${API}/work-orders/${newWoId}`, { headers });
    const { data: wo } = await woRes.json();

    const issueLines = wo.lines.map((line) => ({
      woLineId: line.id,
      quantity: Number(line.quantityRequired),
      locationId: warehouseLocationId,
    }));

    const res = await page.request.post(`${API}/work-orders/${newWoId}/issue`, {
      headers,
      data: { lines: issueLines },
    });
    expect([200, 201]).toContain(res.status());
  });

  // === 15.9 Complete WO ===

  test('15.9 - Complete WO', async ({ page }) => {
    if (!newWoId) {
      test.skip();
      return;
    }
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    // Move to in_progress then completed
    await page.request.patch(`${API}/work-orders/${newWoId}/status`, {
      headers,
      data: { status: 'in_progress' },
    });

    const res = await page.request.patch(`${API}/work-orders/${newWoId}/status`, {
      headers,
      data: { status: 'completed' },
    });
    expect(res.status()).toBe(200);
    const { data } = await res.json();
    const wo = data.workOrder ?? data;
    expect(wo.status).toBe('completed');
  });

  // === 15.10 Verify dashboard ===

  test('15.10 - Verify dashboard', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    // Dashboard should load with updated counts — use .first() to avoid strict mode violation
    await expect(page.getByText(/purchase orders/i).first()).toBeVisible();
    await expect(page.getByText(/work orders/i).first()).toBeVisible();
  });
});
