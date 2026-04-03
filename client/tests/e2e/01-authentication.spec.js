// UAT Section 1: Authentication
// Tests 1.1.1 - 1.2.3

import { test, expect } from '@playwright/test';
import { ADMIN, login, logout } from './helpers.js';

test.describe.serial('1. Authentication', () => {

  // === 1.1 Login ===

  test('1.1.1 - Successful login', async ({ page }) => {
    await login(page, ADMIN);
    // Should be on dashboard
    await expect(page).toHaveURL('/');
    // Welcome message with user's first name
    await expect(page.getByText(/welcome back/i)).toBeVisible();
  });

  test('1.1.2 - Wrong password', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(ADMIN.email);
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByLabel(/tenant|slug|company/i).fill(ADMIN.tenantSlug);
    await page.getByRole('button', { name: /login|sign in/i }).click();
    // Should stay on login page with error
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/invalid|failed|incorrect/i)).toBeVisible();
  });

  test('1.1.3 - Wrong tenant slug', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(ADMIN.email);
    await page.getByLabel(/password/i).fill(ADMIN.password);
    await page.getByLabel(/tenant|slug|company/i).fill('fake-shop');
    await page.getByRole('button', { name: /login|sign in/i }).click();
    // Should stay on login page with error
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/invalid|failed|not found/i)).toBeVisible();
  });

  test('1.1.4 - Empty fields', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /login|sign in/i }).click();
    // Should stay on login page — either HTML5 validation or custom error
    await expect(page).toHaveURL(/\/login/);
  });

  test.skip('1.1.5 - Redirect after login (deferred UX item)', async ({ page }) => {
    // Known minor UX issue: after login, user lands on dashboard
    // instead of the originally requested page. Deferred per user decision.
    await page.goto('/items');
    await expect(page).toHaveURL(/\/login/);
    await login(page, ADMIN);
    await expect(page).toHaveURL('/items');
  });

  // === 1.2 Session & Logout ===

  test('1.2.1 - Logout', async ({ page }) => {
    await login(page, ADMIN);
    await logout(page);
    await expect(page).toHaveURL(/\/login/);
    // Attempting to navigate to /items should redirect to login
    await page.goto('/items');
    await expect(page).toHaveURL(/\/login/);
  });

  test('1.2.2 - Session persistence', async ({ page }) => {
    await login(page, ADMIN);
    // Verify we're on dashboard
    await expect(page).toHaveURL('/');
    // Navigate away and come back (simulates closing/reopening tab)
    await page.goto('/');
    // Should still be logged in
    await expect(page.getByText(/welcome back/i)).toBeVisible();
  });

  test('1.2.3 - Protected route guard', async ({ page }) => {
    // Fresh page, not logged in
    await page.goto('/items');
    await expect(page).toHaveURL(/\/login/);
  });
});
