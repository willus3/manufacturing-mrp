// UAT Section 12: Admin — User Management
// Tests 12.1.1 - 12.4.3
// Must be logged in as admin with users:manage permission.

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

test.describe.serial('12. Admin — User Management', () => {
  let token;
  let janeUserId;
  let shopFloorRoleId;
  let inventoryClerkRoleId;

  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN);
  });

  // Setup: find role IDs
  test('12.0 - Setup roles', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const rolesRes = await page.request.get(`${API}/admin/roles`, { headers });
    const { data: roles } = await rolesRes.json();
    const sfRole = roles.find((r) => r.name.match(/shop floor/i));
    const icRole = roles.find((r) => r.name.match(/inventory clerk/i));
    shopFloorRoleId = sfRole?.id;
    inventoryClerkRoleId = icRole?.id;
    expect(shopFloorRoleId).toBeTruthy();
    expect(inventoryClerkRoleId).toBeTruthy();
  });

  // === 12.1 User List ===

  test('12.1.1 - Navigate to users', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.getByText(/user/i).first()).toBeVisible();
  });

  test('12.1.2 - Search', async ({ page }) => {
    await page.goto('/admin/users');
    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('admin');
      await page.waitForTimeout(500);
      await expect(page.locator('tbody tr').first()).toBeVisible();
    }
  });

  test('12.1.3 - Status filter', async ({ page }) => {
    await page.goto('/admin/users');
    // If status filter exists, try switching to All
    const filterSelect = page.getByRole('combobox').first();
    if (await filterSelect.isVisible().catch(() => false)) {
      await filterSelect.click();
      await page.waitForTimeout(300);
    }
  });

  // === 12.2 Create User ===

  test('12.2.1 - Navigate to create', async ({ page }) => {
    await page.goto('/admin/users/new');
    await expect(page.getByLabel(/first name/i)).toBeVisible();
  });

  test('12.2.2 - Create user', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const res = await page.request.post(`${API}/admin/users`, {
      headers,
      data: {
        firstName: 'Jane',
        lastName: 'Tester',
        email: 'jane@test.com',
        password: 'testpass123',
        roleIds: [shopFloorRoleId],
      },
    });
    expect(res.status()).toBe(201);
    const { data: user } = await res.json();
    janeUserId = user.id;
    expect(user.email).toBe('jane@test.com');
  });

  test('12.2.3 - Duplicate email', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const res = await page.request.post(`${API}/admin/users`, {
      headers,
      data: {
        firstName: 'Duplicate',
        lastName: 'User',
        email: 'jane@test.com',
        password: 'testpass123',
        roleIds: [shopFloorRoleId],
      },
    });
    expect(res.status()).toBe(409);
  });

  test('12.2.4 - Validation — short password', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const res = await page.request.post(`${API}/admin/users`, {
      headers,
      data: {
        firstName: 'Short',
        lastName: 'Pass',
        email: 'shortpass@test.com',
        password: 'abc',
        roleIds: [shopFloorRoleId],
      },
    });
    expect(res.status()).toBe(400);
  });

  test('12.2.5 - Validation — no role', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const res = await page.request.post(`${API}/admin/users`, {
      headers,
      data: {
        firstName: 'No',
        lastName: 'Role',
        email: 'norole@test.com',
        password: 'testpass123',
        roleIds: [],
      },
    });
    expect(res.status()).toBe(400);
  });

  // === 12.3 Edit User ===

  test('12.3.1 - Edit user', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const res = await page.request.put(`${API}/admin/users/${janeUserId}`, {
      headers,
      data: { lastName: 'Supervisor' },
    });
    expect(res.status()).toBe(200);
    const { data: updated } = await res.json();
    expect(updated.lastName).toBe('Supervisor');
  });

  test('12.3.2 - Change roles', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const res = await page.request.put(`${API}/admin/users/${janeUserId}`, {
      headers,
      data: { roleIds: [inventoryClerkRoleId] },
    });
    expect(res.status()).toBe(200);
  });

  test('12.3.3 - Change password', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const res = await page.request.put(`${API}/admin/users/${janeUserId}`, {
      headers,
      data: { password: 'newpass456' },
    });
    expect(res.status()).toBe(200);
  });

  test('12.3.4 - Leave password blank', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    // Update name only, no password field
    const res = await page.request.put(`${API}/admin/users/${janeUserId}`, {
      headers,
      data: { firstName: 'Janet' },
    });
    expect(res.status()).toBe(200);
    const { data: updated } = await res.json();
    expect(updated.firstName).toBe('Janet');

    // Verify Jane can still log in with the changed password
    const loginRes = await page.request.post(`${API}/auth/login`, {
      data: { email: 'jane@test.com', password: 'newpass456', tenantSlug: ADMIN.tenantSlug },
    });
    expect(loginRes.status()).toBe(200);
  });

  // === 12.4 Deactivate User ===

  test('12.4.1 - Cannot deactivate self', async ({ page }) => {
    // Navigate to own user — deactivate button should not appear
    await page.goto('/admin/users');
    await page.waitForTimeout(500);
    // The admin viewing their own profile should not see deactivate
    // This is a UI-level check — verify via the page
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    // Find admin user ID from the user list
    const usersRes = await page.request.get(`${API}/admin/users?search=admin`, { headers });
    const { data: users } = await usersRes.json();
    const adminUser = users.find((u) => u.email === ADMIN.email);

    // Go to admin's own edit page
    if (adminUser) {
      await page.goto(`/admin/users/${adminUser.id}`);
      await page.waitForTimeout(500);
      // Deactivate button should not be present for self
      const deactivateBtn = page.getByRole('button', { name: /deactivate/i });
      await expect(deactivateBtn).not.toBeVisible();
    }
  });

  test('12.4.2 - Deactivate other user', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const res = await page.request.patch(`${API}/admin/users/${janeUserId}/deactivate`, {
      headers,
    });
    expect(res.status()).toBe(200);
    const { data: deactivated } = await res.json();
    expect(deactivated.isActive).toBe(false);
  });

  test('12.4.3 - Deactivated user login', async ({ page }) => {
    // Try logging in as deactivated Jane
    const loginRes = await page.request.post(`${API}/auth/login`, {
      data: { email: 'jane@test.com', password: 'newpass456', tenantSlug: ADMIN.tenantSlug },
    });
    // Should fail — deactivated users cannot log in
    expect([401, 403]).toContain(loginRes.status());
  });
});
