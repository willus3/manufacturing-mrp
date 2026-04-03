// UAT Section 5: Locations (Master Data)
// Tests 5.1 - 5.5

import { test, expect } from '@playwright/test';
import { ADMIN, login } from './helpers.js';

test.describe.serial('5. Locations', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN);
  });

  test('5.1 - List loads', async ({ page }) => {
    await page.goto('/inventory/locations');
    await expect(page.getByRole('columnheader', { name: /code/i })).toBeVisible();
  });

  test('5.2 - Create location', async ({ page }) => {
    await page.goto('/inventory/locations/new');
    await page.getByLabel(/location name|name/i).fill('UAT Warehouse');
    await page.getByLabel(/code/i).fill('UAT-WH');
    await page.getByRole('button', { name: /create|save/i }).click();
    await expect(page).toHaveURL(/\/inventory\/locations$/);
  });

  test('5.3 - Create second location', async ({ page }) => {
    await page.goto('/inventory/locations/new');
    await page.getByLabel(/location name|name/i).fill('UAT Staging');
    await page.getByLabel(/code/i).fill('UAT-STG');
    await page.getByRole('button', { name: /create|save/i }).click();
    await expect(page).toHaveURL(/\/inventory\/locations$/);
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
