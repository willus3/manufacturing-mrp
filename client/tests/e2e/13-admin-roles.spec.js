// UAT Section 13: Admin — Role Management
// Tests 13.1 - 13.9
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

test.describe.serial('13. Admin — Role Management', () => {
  let token;
  let customRoleId;

  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN);
  });

  test('13.1 - Navigate to roles', async ({ page }) => {
    await page.goto('/admin/roles');
    await expect(page.getByText(/role/i).first()).toBeVisible();
  });

  test('13.2 - Default roles present', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const res = await page.request.get(`${API}/admin/roles`, { headers });
    const { data: roles } = await res.json();

    const defaultNames = ['admin', 'production manager', 'purchasing agent', 'shop floor supervisor', 'inventory clerk'];
    for (const name of defaultNames) {
      const found = roles.find((r) => r.name.toLowerCase() === name);
      expect(found).toBeTruthy();
      expect(found.isDefault).toBe(true);
    }
  });

  test('13.3 - Expand role', async ({ page }) => {
    await page.goto('/admin/roles');
    // Click expand on a role card to see permissions
    const expandBtn = page.getByRole('button', { name: /expand|show|chevron/i }).first();
    if (await expandBtn.isVisible().catch(() => false)) {
      await expandBtn.click();
      await page.waitForTimeout(300);
    }
  });

  test('13.4 - View default role', async ({ page }) => {
    await page.goto('/admin/roles');
    // Default roles should show permissions but not be editable
    await expect(page.getByText(/default/i).first()).toBeVisible();
  });

  test('13.5 - Cannot edit default', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    // Find a default role
    const rolesRes = await page.request.get(`${API}/admin/roles`, { headers });
    const { data: roles } = await rolesRes.json();
    const defaultRole = roles.find((r) => r.isDefault && r.name.toLowerCase() === 'admin');

    // Try to update it via API — should be rejected
    if (defaultRole) {
      const res = await page.request.put(`${API}/admin/roles/${defaultRole.id}`, {
        headers,
        data: { name: 'Modified Admin', permissions: ['item:read'] },
      });
      expect([400, 403]).toContain(res.status());
    }
  });

  test('13.6 - Create custom role', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    // Fetch permissions to get UUIDs by code — API requires permissionIds (not string keys)
    const permsRes = await page.request.get(`${API}/admin/permissions`, { headers });
    const { data: allPerms } = await permsRes.json();
    const wantedCodes = ['item:read', 'inventory:read', 'bom:read'];
    const permissionIds = allPerms
      .filter((p) => wantedCodes.includes(p.code))
      .map((p) => p.id);
    expect(permissionIds.length).toBe(3);

    // Check if 'Quality Inspector' already exists from a prior test run — reuse if so
    const rolesRes = await page.request.get(`${API}/admin/roles`, { headers });
    const { data: existingRoles } = await rolesRes.json();
    const existing = existingRoles.find((r) => r.name === 'Quality Inspector');
    if (existing) {
      customRoleId = existing.id;
      expect(existing.isDefault).toBe(false);
      return;
    }

    const res = await page.request.post(`${API}/admin/roles`, {
      headers,
      data: { name: 'Quality Inspector', permissionIds },
    });
    expect(res.status()).toBe(201);
    const { data: role } = await res.json();
    customRoleId = role.id;
    expect(role.isDefault).toBe(false);
  });

  test('13.7 - Edit custom role', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    // Fetch permissions to get UUIDs by code
    const permsRes = await page.request.get(`${API}/admin/permissions`, { headers });
    const { data: allPerms } = await permsRes.json();
    const wantedCodes = ['item:read', 'inventory:read', 'bom:read', 'workorder:read'];
    const permissionIds = allPerms
      .filter((p) => wantedCodes.includes(p.code))
      .map((p) => p.id);
    expect(permissionIds.length).toBe(4);

    const res = await page.request.put(`${API}/admin/roles/${customRoleId}`, {
      headers,
      data: { name: 'Quality Inspector', permissionIds },
    });
    expect(res.status()).toBe(200);
  });

  test('13.8 - Duplicate name', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    // Fetch at least one permission UUID
    const permsRes = await page.request.get(`${API}/admin/permissions`, { headers });
    const { data: allPerms } = await permsRes.json();
    const permissionIds = [allPerms.find((p) => p.code === 'item:read').id];

    const res = await page.request.post(`${API}/admin/roles`, {
      headers,
      data: { name: 'Admin', permissionIds },
    });
    expect(res.status()).toBe(409);
  });

  test('13.9 - User count', async ({ page }) => {
    token = await getToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const res = await page.request.get(`${API}/admin/roles`, { headers });
    const { data: roles } = await res.json();

    // Each role should have a userCount field
    const adminRole = roles.find((r) => r.name.toLowerCase() === 'admin');
    expect(adminRole).toBeTruthy();
    expect(typeof adminRole.userCount).toBe('number');
    expect(adminRole.userCount).toBeGreaterThanOrEqual(1);
  });
});
