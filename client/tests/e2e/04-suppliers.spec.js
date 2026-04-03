// UAT Section 4: Suppliers (Master Data)
// Tests 4.1 - 4.6

import { test, expect } from '@playwright/test';
import { ADMIN, login, sidebarNav } from './helpers.js';

test.describe.serial('4. Suppliers', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN);
  });

  test('4.1 - List loads', async ({ page }) => {
    await sidebarNav(page, 'Suppliers');
    await expect(page).toHaveURL(/\/suppliers/);
    await expect(page.getByRole('columnheader', { name: /name/i })).toBeVisible();
  });

  test('4.2 - Create supplier', async ({ page }) => {
    await page.goto('/suppliers/new');
    await page.getByLabel(/name/i).first().fill('UAT Supplier Inc');
    await page.getByLabel(/code/i).fill('UAT-SUP');
    await page.getByRole('button', { name: /create|save/i }).click();
    await expect(page).toHaveURL(/\/suppliers$/);
  });

  test('4.3 - Edit supplier', async ({ page }) => {
    await page.goto('/suppliers');
    await page.getByPlaceholder(/search/i).fill('UAT Supplier');
    await page.waitForTimeout(500);
    await page.locator('tbody tr').first().click();

    await page.getByLabel(/contact name/i).fill('John Doe');
    await page.getByLabel(/contact email/i).fill('john@uatsupplier.com');
    await page.getByLabel(/contact phone/i).fill('555-0123');
    await page.getByRole('button', { name: /update|save/i }).click();
    await expect(page).toHaveURL(/\/suppliers$/);
  });

  test('4.4 - Duplicate code', async ({ page }) => {
    await page.goto('/suppliers/new');
    await page.getByLabel(/name/i).first().fill('Another Supplier');
    await page.getByLabel(/code/i).fill('UAT-SUP');
    await page.getByRole('button', { name: /create|save/i }).click();
    // Should show duplicate error
    await expect(page.getByText(/duplicate|already exists/i)).toBeVisible();
  });

  test('4.5 - Search', async ({ page }) => {
    await page.goto('/suppliers');
    await page.getByPlaceholder(/search/i).fill('UAT');
    await page.waitForTimeout(500);
    await expect(page.locator('tbody tr').first()).toBeVisible();
  });

  test('4.6 - Deactivate', async ({ page }) => {
    // Create a throwaway supplier to deactivate
    await page.goto('/suppliers/new');
    await page.getByLabel(/name/i).first().fill('Deactivate Me Supplier');
    await page.getByLabel(/code/i).fill('UAT-DEL');
    await page.getByRole('button', { name: /create|save/i }).click();
    await expect(page).toHaveURL(/\/suppliers$/);

    // Find and deactivate
    await page.getByPlaceholder(/search/i).fill('Deactivate Me');
    await page.waitForTimeout(500);
    await page.locator('tbody tr').first().click();
    await page.getByRole('button', { name: /deactivate/i }).click();
    await expect(page).toHaveURL(/\/suppliers$/);
  });
});
