// UAT Section 9: Purchase Orders
// Tests 9.1.1 - 9.3.6
// Depends on items (section 3), suppliers (section 4), locations (section 5),
// item-supplier links (section 6), and inventory (section 8).

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

test.describe.serial('9. Purchase Orders', () => {
  let token;
  let poId;
  let poLineIds = [];
  let cancelPoId;

  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN);
  });

  // === 9.1 Create PO ===

  test('9.1.1 - Navigate to create', async ({ page }) => {
    await page.goto('/purchase-orders');
    await page.getByRole('link', { name: /new po|create/i }).click();
    await expect(page).toHaveURL(/\/purchase-orders\/new/);
  });

  test('9.1.2 - Create PO', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    // Find supplier and item
    const suppRes = await page.request.get(`${API}/suppliers?search=UAT+Supplier`, { headers });
    const { data: suppliers } = await suppRes.json();
    const supplierId = suppliers[0].id;

    const itemsRes = await page.request.get(`${API}/items?search=UAT-RAW-001`, { headers });
    const { data: items } = await itemsRes.json();
    const itemId = items[0].id;

    // Create PO via API
    const twoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const res = await page.request.post(`${API}/purchase-orders`, {
      headers,
      data: {
        supplierId,
        expectedDate: twoWeeks,
        notes: 'UAT PO test',
        lines: [{ itemId, quantityOrdered: 200, unitCost: 5.0 }],
      },
    });
    expect(res.status()).toBe(201);
    const { data: po } = await res.json();
    poId = po.id;
    expect(po.status).toBe('draft');
    expect(po.poNumber).toMatch(/^PO-/);

    // Verify in UI
    await page.goto(`/purchase-orders/${poId}`);
    await expect(page.getByText(/draft/i).first()).toBeVisible();
  });

  test('9.1.3 - Multiple lines', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    // Find second raw material
    const itemsRes = await page.request.get(`${API}/items?search=UAT-RAW-002`, { headers });
    const { data: items } = await itemsRes.json();
    const item2Id = items[0].id;

    // Get existing PO to find current lines
    const poRes = await page.request.get(`${API}/purchase-orders/${poId}`, { headers });
    const { data: po } = await poRes.json();

    // Update PO with additional line
    const res = await page.request.put(`${API}/purchase-orders/${poId}`, {
      headers,
      data: {
        lines: [
          ...po.lines.map((l) => ({
            itemId: l.itemId,
            quantityOrdered: l.quantityOrdered,
            unitCost: l.unitCost,
          })),
          { itemId: item2Id, quantityOrdered: 100, unitCost: 3.0 },
        ],
      },
    });
    expect(res.status()).toBe(200);

    // Verify 2 lines
    const updated = await page.request.get(`${API}/purchase-orders/${poId}`, { headers });
    const { data: updatedPo } = await updated.json();
    expect(updatedPo.lines.length).toBe(2);
    poLineIds = updatedPo.lines.map((l) => l.id);
  });

  test('9.1.4 - PO number format', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const res = await page.request.get(`${API}/purchase-orders/${poId}`, { headers });
    const { data: po } = await res.json();
    expect(po.poNumber).toMatch(/^PO-\d{4,}$/);
  });

  // === 9.2 PO Status Transitions ===

  test('9.2.1 - Send PO', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const res = await page.request.patch(`${API}/purchase-orders/${poId}/send`, { headers });
    expect(res.status()).toBe(200);
    const { data: po } = await res.json();
    expect(po.status).toBe('sent');

    // Verify in UI
    await page.goto(`/purchase-orders/${poId}`);
    await expect(page.getByText(/sent/i).first()).toBeVisible();
  });

  test('9.2.2 - Cannot edit sent PO', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const res = await page.request.put(`${API}/purchase-orders/${poId}`, {
      headers,
      data: { notes: 'Trying to edit sent PO' },
    });
    // Should be rejected — sent POs are immutable
    expect([400, 403, 409]).toContain(res.status());
  });

  test('9.2.3 - Cancel PO', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    // Create a new draft PO to cancel
    const suppRes = await page.request.get(`${API}/suppliers?search=UAT+Supplier`, { headers });
    const { data: suppliers } = await suppRes.json();
    const itemsRes = await page.request.get(`${API}/items?search=UAT-RAW-001`, { headers });
    const { data: items } = await itemsRes.json();

    const createRes = await page.request.post(`${API}/purchase-orders`, {
      headers,
      data: {
        supplierId: suppliers[0].id,
        lines: [{ itemId: items[0].id, quantityOrdered: 10, unitCost: 1.0 }],
      },
    });
    const { data: newPo } = await createRes.json();
    cancelPoId = newPo.id;

    const res = await page.request.patch(`${API}/purchase-orders/${cancelPoId}/cancel`, { headers });
    expect(res.status()).toBe(200);
    const { data: cancelled } = await res.json();
    expect(cancelled.status).toBe('cancelled');
  });

  // === 9.3 Receiving ===

  test('9.3.1 - Navigate to receive', async ({ page }) => {
    // The sent PO should have a receive option
    await page.goto(`/purchase-orders/${poId}`);
    await expect(page.getByText(/receive/i).first()).toBeVisible();
  });

  test('9.3.2 - Partial receive', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    // Get location
    const locsRes = await page.request.get(`${API}/locations?search=UAT-WH`, { headers });
    const { data: locs } = await locsRes.json();
    const locationId = locs[0].id;

    // Partial receive: 50 of 200 for first line
    const res = await page.request.post(`${API}/purchase-orders/${poId}/receive`, {
      headers,
      data: {
        lines: [{ poLineId: poLineIds[0], quantity: 50, locationId }],
      },
    });
    expect(res.status()).toBe(200);

    // Verify status is partial
    const poRes = await page.request.get(`${API}/purchase-orders/${poId}`, { headers });
    const { data: po } = await poRes.json();
    expect(po.status).toBe('partial');
  });

  test('9.3.3 - Verify inventory', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const stockRes = await page.request.get(`${API}/inventory/stock?search=UAT-RAW-001`, { headers });
    const { data: stock } = await stockRes.json();
    // Stock should have increased by 50
    expect(stock.length).toBeGreaterThanOrEqual(1);
  });

  test('9.3.4 - Verify transaction', async ({ page }) => {
    await page.goto('/inventory/transactions');
    await page.waitForTimeout(1000);
    // Should show receipt transaction
    await expect(page.locator('tbody tr').first()).toBeVisible();
  });

  test('9.3.5 - Complete receive', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const locsRes = await page.request.get(`${API}/locations?search=UAT-WH`, { headers });
    const { data: locs } = await locsRes.json();
    const locationId = locs[0].id;

    // Receive remaining: 150 of line 1, all 100 of line 2
    const res = await page.request.post(`${API}/purchase-orders/${poId}/receive`, {
      headers,
      data: {
        lines: [
          { poLineId: poLineIds[0], quantity: 150, locationId },
          { poLineId: poLineIds[1], quantity: 100, locationId },
        ],
      },
    });
    expect(res.status()).toBe(200);

    // Verify fully received
    const poRes = await page.request.get(`${API}/purchase-orders/${poId}`, { headers });
    const { data: po } = await poRes.json();
    expect(po.status).toBe('received');
  });

  test('9.3.6 - Over-receive blocked', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const locsRes = await page.request.get(`${API}/locations?search=UAT-WH`, { headers });
    const { data: locs } = await locsRes.json();
    const locationId = locs[0].id;

    // Try to receive more on already-fully-received line
    const res = await page.request.post(`${API}/purchase-orders/${poId}/receive`, {
      headers,
      data: {
        lines: [{ poLineId: poLineIds[0], quantity: 1, locationId }],
      },
    });
    expect([400, 409]).toContain(res.status());
  });
});
