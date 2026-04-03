// UAT Section 14: RBAC — Permission Enforcement
// Tests 14.1 - 14.10
// Verifies that permissions actually restrict access.
// Uses Jane (jane@test.com) with limited Inventory Clerk role.
// Depends on user created in section 12.

import { test, expect } from '@playwright/test';
import { ADMIN, login } from './helpers.js';

const API = 'http://localhost:3000/api/v1';

const JANE = {
  email: 'jane@test.com',
  password: 'newpass456',
  tenantSlug: 'test-shop',
};

async function getToken(page, creds = ADMIN) {
  const res = await page.request.post(`${API}/auth/login`, {
    data: { email: creds.email, password: creds.password, tenantSlug: creds.tenantSlug },
  });
  const { data } = await res.json();
  return data.accessToken;
}

test.describe.serial('14. RBAC — Permission Enforcement', () => {
  let adminToken;
  let janeUserId;

  // === 14.1 Setup test user ===

  test('14.1 - Setup test user', async ({ page }) => {
    await login(page, ADMIN);
    adminToken = await getToken(page, ADMIN);
    const headers = { Authorization: `Bearer ${adminToken}` };

    // Find Jane
    const usersRes = await page.request.get(`${API}/admin/users?search=jane`, { headers });
    const { data: users } = await usersRes.json();
    const jane = users.find((u) => u.email === 'jane@test.com');

    if (!jane) {
      // Create Jane if she doesn't exist
      const rolesRes = await page.request.get(`${API}/admin/roles`, { headers });
      const { data: roles } = await rolesRes.json();
      const icRole = roles.find((r) => r.name.match(/inventory clerk/i));

      const createRes = await page.request.post(`${API}/admin/users`, {
        headers,
        data: {
          firstName: 'Jane',
          lastName: 'Tester',
          email: 'jane@test.com',
          password: 'newpass456',
          roleIds: [icRole.id],
        },
      });
      const { data: newUser } = await createRes.json();
      janeUserId = newUser.id;
    } else {
      janeUserId = jane.id;

      // Re-activate Jane if deactivated
      if (!jane.isActive) {
        // Re-activate by updating isActive (or recreate)
        await page.request.put(`${API}/admin/users/${janeUserId}`, {
          headers,
          data: { isActive: true },
        });
      }

      // Ensure Jane has only Inventory Clerk role
      const rolesRes = await page.request.get(`${API}/admin/roles`, { headers });
      const { data: roles } = await rolesRes.json();
      const icRole = roles.find((r) => r.name.match(/inventory clerk/i));

      await page.request.put(`${API}/admin/users/${janeUserId}`, {
        headers,
        data: { roleIds: [icRole.id], password: 'newpass456' },
      });
    }
  });

  // === 14.2 Login as limited user ===

  test('14.2 - Login as limited user', async ({ page }) => {
    await login(page, JANE);
    await expect(page.getByText(/dashboard|welcome/i).first()).toBeVisible();
  });

  // === 14.3 Sidebar visibility ===

  test('14.3 - Sidebar visibility', async ({ page }) => {
    await login(page, JANE);

    // Jane should see: Dashboard, Items (read), BOMs (read), Inventory
    await expect(page.getByRole('link', { name: /dashboard/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /inventory/i })).toBeVisible();

    // Jane should NOT see: Suppliers, Purchase Orders, Work Orders, MRP, Admin
    await expect(page.getByRole('link', { name: /suppliers/i })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /purchase orders/i })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /work orders/i })).not.toBeVisible();
  });

  // === 14.4 Can view items ===

  test('14.4 - Can view items', async ({ page }) => {
    await login(page, JANE);
    await page.goto('/items');
    await expect(page.getByText(/item|part/i).first()).toBeVisible();
  });

  // === 14.5 Cannot create items ===

  test('14.5 - Cannot create items', async ({ page }) => {
    await login(page, JANE);
    await page.goto('/items');
    await page.waitForTimeout(500);
    // "New Item" button should not appear
    const newItemBtn = page.getByRole('link', { name: /new item/i });
    await expect(newItemBtn).not.toBeVisible();
  });

  // === 14.6 Can view inventory ===

  test('14.6 - Can view inventory', async ({ page }) => {
    await login(page, JANE);
    await page.goto('/inventory');
    await expect(page.getByText(/stock|inventory/i).first()).toBeVisible();
  });

  // === 14.7 Can adjust inventory ===

  test('14.7 - Can adjust inventory', async ({ page }) => {
    await login(page, JANE);
    await page.goto('/inventory/adjust');
    await expect(page.getByText(/adjust/i).first()).toBeVisible();
  });

  // === 14.8 Direct URL blocked ===

  test('14.8 - Direct URL blocked', async ({ page }) => {
    await login(page, JANE);
    await page.goto('/purchase-orders');
    // Should show access denied or redirect
    await expect(
      page.getByText(/access denied|not authorized|forbidden/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  // === 14.9 Admin blocked ===

  test('14.9 - Admin blocked', async ({ page }) => {
    await login(page, JANE);
    await page.goto('/admin/users');
    // Should show access denied or redirect
    await expect(
      page.getByText(/access denied|not authorized|forbidden/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  // === 14.10 Restore admin ===

  test('14.10 - Restore admin', async ({ page }) => {
    await login(page, ADMIN);
    await expect(page.getByText(/dashboard|welcome/i).first()).toBeVisible();
  });
});
