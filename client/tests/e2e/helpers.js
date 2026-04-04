// Shared helpers for e2e tests.
// Provides login utility and common test accounts.

export const ADMIN = {
  email: 'admin@test.com',
  password: 'password123',
  tenantSlug: 'test-shop',
  firstName: 'Admin',
};

export const SUPER_ADMIN = {
  email: 'superadmin@mrp.system',
  password: 'superadmin123',
  tenantSlug: '', // super admin has no tenant
};

/**
 * Login as a user via the login page.
 * Waits for redirect to dashboard (or wherever the app sends after login).
 */
export async function login(page, { email, password, tenantSlug } = ADMIN) {
  await page.goto('/login');
  // Fill in order: Workspace (tenant slug), Email, Password
  await page.getByLabel(/workspace/i).fill(tenantSlug);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  // Wait for navigation away from login page
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10_000 });
}

/**
 * Logout via the top bar user menu.
 */
export async function logout(page) {
  // Click the user menu button in the top bar (has aria-haspopup)
  await page.locator('header button[aria-haspopup]').click();
  // Click sign out (button with role="menuitem")
  await page.getByRole('menuitem', { name: /sign out/i }).click();
  // Wait for login page
  await page.waitForURL(/\/login/);
}

/**
 * Get a toast message text (Sonner toasts).
 */
export async function getToast(page) {
  const toast = page.locator('[data-sonner-toast]').first();
  await toast.waitFor({ timeout: 5_000 });
  return toast.textContent();
}

/**
 * Wait for a success toast to appear.
 */
export async function expectSuccessToast(page) {
  await page.locator('[data-sonner-toast][data-type="success"], [data-sonner-toast]').first()
    .waitFor({ timeout: 5_000 });
}

/**
 * Navigate via sidebar link.
 */
export async function sidebarNav(page, label) {
  await page.locator('aside').getByRole('link', { name: label }).click();
}
