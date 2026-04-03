// UAT Section 6: Item-Supplier Links
// Tests 6.1 - 6.3
// Note: These tests depend on items and suppliers created in sections 3 and 4.
// The exact UI for item-supplier linking may vary — these tests use the API
// directly since the frontend linking UX may be embedded in the item detail page.

import { test, expect } from '@playwright/test';
import { ADMIN, login } from './helpers.js';

const API = 'http://localhost:3000/api/v1';

// Helper to get auth token
async function getToken(page) {
  const res = await page.request.post(`${API}/auth/login`, {
    data: { email: ADMIN.email, password: ADMIN.password, tenantSlug: ADMIN.tenantSlug },
  });
  const { data } = await res.json();
  return data.accessToken;
}

test.describe.serial('6. Item-Supplier Links', () => {
  let token;
  let rawItemId;
  let supplierId;
  let secondSupplierId;

  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN);
  });

  test('6.1 - Link supplier to item', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    // Find UAT-RAW-001 item
    const itemsRes = await page.request.get(`${API}/items?search=UAT-RAW-001`, { headers });
    const { data: items } = await itemsRes.json();
    rawItemId = items[0].id;

    // Find UAT Supplier Inc
    const suppRes = await page.request.get(`${API}/suppliers?search=UAT+Supplier`, { headers });
    const { data: suppliers } = await suppRes.json();
    supplierId = suppliers[0].id;

    // Link them
    const linkRes = await page.request.post(`${API}/items/${rawItemId}/suppliers`, {
      headers,
      data: { supplierId, unitCost: 5.00, leadTimeDays: 14, isPreferred: true },
    });
    expect(linkRes.status()).toBe(201);
  });

  test('6.2 - Set preferred supplier', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    // Verify the link exists with preferred flag
    const linksRes = await page.request.get(`${API}/items/${rawItemId}/suppliers`, { headers });
    const { data: links } = await linksRes.json();

    const preferredLink = links.find((l) => l.supplierId === supplierId);
    expect(preferredLink).toBeTruthy();
    expect(preferredLink.isPreferred).toBe(true);
    expect(Number(preferredLink.unitCost)).toBe(5);
    expect(preferredLink.leadTimeDays).toBe(14);
  });

  test('6.3 - Multiple suppliers', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    // Create a second supplier
    const createRes = await page.request.post(`${API}/suppliers`, {
      headers,
      data: { name: 'UAT Second Supplier', code: 'UAT-SUP2' },
    });
    const { data: newSupp } = await createRes.json();
    secondSupplierId = newSupp.id;

    // Link second supplier (not preferred)
    const linkRes = await page.request.post(`${API}/items/${rawItemId}/suppliers`, {
      headers,
      data: { supplierId: secondSupplierId, unitCost: 6.00, leadTimeDays: 21, isPreferred: false },
    });
    expect(linkRes.status()).toBe(201);

    // Verify both links exist
    const linksRes = await page.request.get(`${API}/items/${rawItemId}/suppliers`, { headers });
    const { data: links } = await linksRes.json();
    expect(links.length).toBeGreaterThanOrEqual(2);
  });
});
