// UAT Section 2: Dashboard
// Tests 2.1 - 2.13

import { test, expect } from '@playwright/test';
import { ADMIN, login, sidebarNav } from './helpers.js';

test.describe.serial('2. Dashboard', () => {

  test.beforeAll(async ({ browser }) => {
    // Pre-login for this suite
    const page = await browser.newPage();
    await login(page, ADMIN);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN);
  });

  test('2.1 - Dashboard loads', async ({ page }) => {
    await page.goto('/');
    // Should have 4 dashboard cards
    await expect(page.getByText('Low Stock Alerts')).toBeVisible();
    await expect(page.getByText('Purchase Orders')).toBeVisible();
    await expect(page.getByText('Work Orders')).toBeVisible();
    await expect(page.getByText('MRP & Demand')).toBeVisible();
  });

  test('2.2 - Low Stock Alerts — empty', async ({ page }) => {
    await page.goto('/');
    // With seed data (no reorder points configured), should show 0
    const alertCard = page.locator('button', { hasText: 'Low Stock Alerts' });
    await expect(alertCard.getByText('0')).toBeVisible();
    await expect(alertCard.getByText(/all items above reorder point/i)).toBeVisible();
  });

  test('2.3 - Low Stock Alerts — trigger', async ({ page }) => {
    // Edit an item to have a high reorder point via API
    const apiBase = 'http://localhost:3000/api/v1';
    const loginRes = await page.request.post(`${apiBase}/auth/login`, {
      data: { email: ADMIN.email, password: ADMIN.password, tenantSlug: ADMIN.tenantSlug },
    });
    const { data: loginData } = await loginRes.json();
    const token = loginData.accessToken;
    const headers = { Authorization: `Bearer ${token}` };

    // Get an item
    const itemsRes = await page.request.get(`${apiBase}/items?pageSize=1`, { headers });
    const { data: items } = await itemsRes.json();
    const item = items[0];

    // Set a high reorder point
    await page.request.put(`${apiBase}/items/${item.id}`, {
      headers,
      data: { reorderPoint: 999999 },
    });

    // Check dashboard
    await page.goto('/');
    await page.waitForTimeout(1000); // Wait for data to refresh
    const alertCard = page.locator('button', { hasText: 'Low Stock Alerts' });
    // Count should be >= 1
    const countText = await alertCard.locator('.text-3xl').textContent();
    expect(Number(countText)).toBeGreaterThanOrEqual(1);

    // Clean up — remove reorder point
    await page.request.put(`${apiBase}/items/${item.id}`, {
      headers,
      data: { reorderPoint: null },
    });
  });

  test('2.4 - Low Stock Alerts — clear', async ({ page }) => {
    // After cleanup in 2.3, alerts should be back to 0
    await page.goto('/');
    await page.waitForTimeout(1000);
    const alertCard = page.locator('button', { hasText: 'Low Stock Alerts' });
    await expect(alertCard.getByText('0')).toBeVisible();
  });

  test('2.5 - PO counts', async ({ page }) => {
    await page.goto('/');
    const poCard = page.locator('button', { hasText: 'Purchase Orders' });
    // Should show status labels
    await expect(poCard.getByText('Draft')).toBeVisible();
    await expect(poCard.getByText('Sent')).toBeVisible();
    await expect(poCard.getByText('Partial')).toBeVisible();
    await expect(poCard.getByText('Overdue')).toBeVisible();
  });

  test('2.6 - WO counts', async ({ page }) => {
    await page.goto('/');
    const woCard = page.locator('button', { hasText: 'Work Orders' });
    await expect(woCard.getByText('Planned')).toBeVisible();
    await expect(woCard.getByText('Released')).toBeVisible();
    await expect(woCard.getByText('In Progress')).toBeVisible();
    await expect(woCard.getByText('Completed')).toBeVisible();
  });

  test('2.7 - Open demand count', async ({ page }) => {
    await page.goto('/');
    const mrpCard = page.locator('button', { hasText: 'MRP & Demand' });
    await expect(mrpCard.getByText(/open demand/i)).toBeVisible();
  });

  test('2.8 - Last MRP run', async ({ page }) => {
    await page.goto('/');
    const mrpCard = page.locator('button', { hasText: 'MRP & Demand' });
    // Either shows "Last run:" or "No MRP runs yet" — both are valid
    const hasRun = await mrpCard.getByText(/last run/i).isVisible().catch(() => false);
    const noRun = await mrpCard.getByText(/no mrp runs/i).isVisible().catch(() => false);
    expect(hasRun || noRun).toBeTruthy();
  });

  test('2.9 - Card navigation — POs', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: 'Purchase Orders' }).click();
    await expect(page).toHaveURL(/\/purchase-orders/);
  });

  test('2.10 - Card navigation — WOs', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: 'Work Orders' }).click();
    await expect(page).toHaveURL(/\/work-orders/);
  });

  test('2.11 - Card navigation — Inventory', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: 'Low Stock Alerts' }).click();
    await expect(page).toHaveURL(/\/inventory/);
  });

  test('2.12 - Card navigation — MRP', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: 'MRP & Demand' }).click();
    await expect(page).toHaveURL(/\/mrp\/demand/);
  });

  test('2.13 - Unconverted suggestions link', async ({ page }) => {
    await page.goto('/');
    const mrpCard = page.locator('button', { hasText: 'MRP & Demand' });
    const suggestionsLink = mrpCard.getByText(/unconverted suggestions/i);
    // This link only exists if there are unconverted suggestions
    if (await suggestionsLink.isVisible().catch(() => false)) {
      await suggestionsLink.click();
      await expect(page).toHaveURL(/\/mrp\/results\//);
    } else {
      // No unconverted suggestions — test passes as N/A
      test.skip();
    }
  });
});
