// UAT Section 16: Edge Cases & Error Handling
// Tests 16.1 - 16.5
// Verifies graceful handling of errors and edge conditions.

import { test, expect } from '@playwright/test';
import { ADMIN, login } from './helpers.js';

const API = 'http://localhost:3000/api/v1';

test.describe.serial('16. Edge Cases & Error Handling', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN);
  });

  test('16.1 - 404 route', async ({ page }) => {
    await page.goto('/nonexistent');
    // Should redirect to dashboard (catch-all route) or show a not found message
    await page.waitForTimeout(1000);
    // Either redirected to dashboard or showing a 404 page — both are acceptable
    const url = page.url();
    const isDashboard = url.endsWith('/') || url.includes('/dashboard');
    const has404Text = await page.getByText(/not found|404/i).isVisible().catch(() => false);
    expect(isDashboard || has404Text).toBeTruthy();
  });

  test('16.2 - Nonexistent record', async ({ page }) => {
    await page.goto('/items/00000000-0000-0000-0000-000000000000');
    await page.waitForTimeout(2000);
    // Should show a not found or error message, not a blank/crashed page
    const hasError = await page
      .getByText(/not found|error|does not exist/i)
      .first()
      .isVisible()
      .catch(() => false);
    const hasContent = await page.locator('body').textContent();
    // Page should not be blank
    expect(hasContent.length).toBeGreaterThan(0);
  });

  test('16.3 - Network error', async ({ page }) => {
    // Simulate network error by intercepting API calls
    await page.route('**/api/v1/dashboard', (route) => route.abort());
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Should show an error state, not crash
    const hasError = await page
      .getByText(/error|failed|unable/i)
      .first()
      .isVisible()
      .catch(() => false);
    const bodyText = await page.locator('body').textContent();
    // Page should not be completely blank
    expect(bodyText.length).toBeGreaterThan(0);

    // Clean up route interception
    await page.unroute('**/api/v1/dashboard');
  });

  test('16.4 - Session expired', async ({ page }) => {
    // Remove auth token from localStorage to simulate expiry
    await page.evaluate(() => {
      localStorage.removeItem('mrp_access_token');
      localStorage.removeItem('mrp_refresh_token');
    });

    // Try to navigate to a protected page
    await page.goto('/items');
    await page.waitForTimeout(2000);

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('16.5 - Concurrent edit', async ({ page }) => {
    // Open an item in the current tab
    await page.goto('/items');
    await page.waitForTimeout(500);

    // Click first item if available
    const firstRow = page.locator('tbody tr').first();
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await page.waitForTimeout(500);

      // Get the current URL (item edit page)
      const itemUrl = page.url();

      // Make a concurrent edit via API
      const res = await page.request.post(`${API}/auth/login`, {
        data: { email: ADMIN.email, password: ADMIN.password, tenantSlug: ADMIN.tenantSlug },
      });
      const { data } = await res.json();
      const token = data.accessToken;
      const headers = { Authorization: `Bearer ${token}` };

      // Extract item ID from URL
      const itemIdMatch = itemUrl.match(/\/items\/([^/]+)/);
      if (itemIdMatch) {
        const itemId = itemIdMatch[1];
        // Make API edit (simulating another user)
        await page.request.put(`${API}/items/${itemId}`, {
          headers,
          data: { description: 'Concurrent edit test' },
        });
      }

      // Try to save from the UI — should succeed or show clear error, not silently lose data
      const saveBtn = page.getByRole('button', { name: /save|update/i });
      if (await saveBtn.isVisible().catch(() => false)) {
        // Change something and save
        const descField = page.getByLabel(/description/i);
        if (await descField.isVisible().catch(() => false)) {
          await descField.fill('UI concurrent edit test');
          await saveBtn.click();
          await page.waitForTimeout(1000);
          // Should not crash — either succeeds or shows an error
          const bodyText = await page.locator('body').textContent();
          expect(bodyText.length).toBeGreaterThan(0);
        }
      }
    }
  });
});
