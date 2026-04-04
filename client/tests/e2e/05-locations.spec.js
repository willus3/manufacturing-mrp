// UAT Section 5: Locations (Master Data)
// Tests 5.1 - 5.5

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

/** Ensure a location exists (create if missing). */
async function ensureLocation(page, token, name, code) {
  const headers = { Authorization: `Bearer ${token}` };
  const search = await page.request.get(`${API}/locations?search=${encodeURIComponent(code)}`, { headers });
  const { data: locations } = await search.json();
  const existing = locations.find((l) => l.code === code);
  if (existing) return existing.id;
  const res = await page.request.post(`${API}/locations`, {
    headers,
    data: { name, code },
  });
  const { data: location } = await res.json();
  return location.id;
}

test.describe.serial('5. Locations', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN);
  });

  test('5.1 - List loads', async ({ page }) => {
    await page.goto('/inventory/locations');
    await expect(page.getByRole('columnheader', { name: /code/i })).toBeVisible();
  });

  test('5.2 - Create location', async ({ page }) => {
    // Use API to ensure idempotency — location may already exist from a prior run
    const token = await getToken(page);
    await ensureLocation(page, token, 'UAT Warehouse', 'UAT-WH');
    // Verify it appears in the list
    await page.goto('/inventory/locations');
    await page.getByPlaceholder(/search/i).fill('UAT-WH').catch(() => {});
    await page.waitForTimeout(500);
    await expect(page.getByText('UAT-WH').first()).toBeVisible();
  });

  test('5.3 - Create second location', async ({ page }) => {
    const token = await getToken(page);
    await ensureLocation(page, token, 'UAT Staging', 'UAT-STG');
    await page.goto('/inventory/locations');
    await page.getByPlaceholder(/search/i).fill('UAT-STG').catch(() => {});
    await page.waitForTimeout(500);
    await expect(page.getByText('UAT-STG').first()).toBeVisible();
  });

  test('5.4 - Edit location', async ({ page }) => {
    await page.goto('/inventory/locations');
    await page.getByPlaceholder(/search/i).fill('UAT Warehouse');
    await page.waitForTimeout(500);
    await page.locator('tbody tr').first().click();

    await page.getByLabel(/description/i).fill('Main warehouse for UAT testing');
    await page.getByRole('button', { name: /update|save/i }).click();
    await expect(page).toHaveURL(/\/inventory\/locations$/);
  });

  test('5.5 - Duplicate code', async ({ page }) => {
    await page.goto('/inventory/locations/new');
    await page.getByLabel(/location name|name/i).fill('Duplicate Location');
    await page.getByLabel(/code/i).fill('UAT-WH');
    await page.getByRole('button', { name: /create|save/i }).click();
    await expect(page.getByText(/duplicate|already exists/i)).toBeVisible();
  });
});
