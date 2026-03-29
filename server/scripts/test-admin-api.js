/**
 * Admin API Test Script
 * Tests: User CRUD, role CRUD, permission listing, deactivation guards.
 *
 * Prerequisites: Server running on port 3000, database seeded.
 */
require('dotenv').config();
const BASE = 'http://localhost:3000/api/v1';

let token = '';
let passed = 0;
let failed = 0;

// --- Helpers ---

const api = async (method, path, body) => {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json();
  return { status: res.status, ...data };
};

const assert = (condition, label) => {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}`);
    failed++;
  }
};

// --- Test Data IDs ---
let testUserId;
let testRoleId;
let adminRoleId;
let permissionIds = [];

const run = async () => {
  console.log('=== Admin API Tests ===\n');

  // 1. Login as tenant admin
  console.log('1. Login as tenant admin');
  const login = await api('POST', '/auth/login', {
    email: 'admin@test.com',
    password: 'password123',
    tenantSlug: 'test-shop',
  });
  assert(login.status === 200, 'Login succeeds');
  token = login.data.accessToken;

  // ============================================
  // PERMISSIONS
  // ============================================
  console.log('\n2. List permissions');
  let res = await api('GET', '/admin/permissions');
  assert(res.status === 200, 'GET /admin/permissions returns 200');
  assert(Array.isArray(res.data), 'Returns array of permissions');
  assert(res.data.length === 18, 'Has all 18 permissions');
  assert(res.data[0].code && res.data[0].description, 'Permissions have code and description');
  permissionIds = res.data.map((p) => p.id);

  // ============================================
  // ROLES
  // ============================================
  console.log('\n3. List roles');
  res = await api('GET', '/admin/roles');
  assert(res.status === 200, 'GET /admin/roles returns 200');
  assert(Array.isArray(res.data), 'Returns array of roles');
  assert(res.data.length >= 5, 'Has at least 5 default roles');
  const adminRole = res.data.find((r) => r.name === 'Admin');
  assert(adminRole && adminRole.isDefault === true, 'Admin role is default');
  assert(adminRole.permissions.length === 18, 'Admin role has all 18 permissions');
  adminRoleId = adminRole.id;

  // 4. Create custom role
  console.log('\n4. Create custom role');
  // Pick first 3 permissions for our test role
  const testPermIds = permissionIds.slice(0, 3);
  res = await api('POST', '/admin/roles', {
    name: `Test Role ${Date.now()}`,
    permissionIds: testPermIds,
  });
  assert(res.status === 201, 'POST /admin/roles returns 201');
  assert(res.data.isDefault === false, 'Custom role is not default');
  assert(res.data.permissions.length === 3, 'Custom role has 3 permissions');
  testRoleId = res.data.id;

  // 5. Update custom role
  console.log('\n5. Update custom role');
  res = await api('PUT', `/admin/roles/${testRoleId}`, {
    name: `Updated Role ${Date.now()}`,
    permissionIds: permissionIds.slice(0, 5),
  });
  assert(res.status === 200, 'PUT /admin/roles/:id returns 200');
  assert(res.data.permissions.length === 5, 'Updated role has 5 permissions');

  // 6. Cannot edit default role
  console.log('\n6. Cannot edit default role');
  res = await api('PUT', `/admin/roles/${adminRoleId}`, {
    name: 'Renamed Admin',
  });
  assert(res.status === 403, 'Editing default role returns 403');

  // ============================================
  // USERS
  // ============================================
  console.log('\n7. List users');
  res = await api('GET', '/admin/users');
  assert(res.status === 200, 'GET /admin/users returns 200');
  assert(Array.isArray(res.data), 'Returns array of users');
  assert(res.meta && res.meta.total >= 1, 'Has pagination meta');
  assert(res.data[0].roles && Array.isArray(res.data[0].roles), 'Users include roles array');

  // 8. Create user
  console.log('\n8. Create user');
  const testEmail = `testuser-${Date.now()}@example.com`;
  res = await api('POST', '/admin/users', {
    email: testEmail,
    firstName: 'Test',
    lastName: 'User',
    password: 'testpassword123',
    roleIds: [testRoleId],
  });
  assert(res.status === 201, 'POST /admin/users returns 201');
  assert(res.data.email === testEmail, 'Created user has correct email');
  assert(res.data.roles.length === 1, 'Created user has 1 role');
  testUserId = res.data.id;

  // 9. Get user by ID
  console.log('\n9. Get user by ID');
  res = await api('GET', `/admin/users/${testUserId}`);
  assert(res.status === 200, 'GET /admin/users/:id returns 200');
  assert(res.data.email === testEmail, 'Fetched correct user');

  // 10. Update user
  console.log('\n10. Update user');
  res = await api('PUT', `/admin/users/${testUserId}`, {
    firstName: 'Updated',
    roleIds: [testRoleId, adminRoleId],
  });
  assert(res.status === 200, 'PUT /admin/users/:id returns 200');
  assert(res.data.firstName === 'Updated', 'Name was updated');
  assert(res.data.roles.length === 2, 'User now has 2 roles');

  // 11. Duplicate email check
  console.log('\n11. Duplicate email check');
  res = await api('POST', '/admin/users', {
    email: testEmail,
    firstName: 'Dupe',
    lastName: 'User',
    password: 'testpassword123',
    roleIds: [testRoleId],
  });
  assert(res.status === 409, 'Duplicate email returns 409');

  // 12. Search users
  console.log('\n12. Search users');
  res = await api('GET', `/admin/users?search=Updated`);
  assert(res.status === 200, 'Search returns 200');
  assert(res.data.length >= 1, 'Search found at least 1 user');

  // 13. Cannot deactivate yourself
  console.log('\n13. Cannot deactivate yourself');
  // Get current user's ID from the login response
  const meRes = await api('GET', '/auth/me');
  const myId = meRes.data.id;
  res = await api('PATCH', `/admin/users/${myId}/deactivate`);
  assert(res.status === 400, 'Cannot deactivate self returns 400');

  // 14. Deactivate test user
  console.log('\n14. Deactivate test user');
  res = await api('PATCH', `/admin/users/${testUserId}/deactivate`);
  assert(res.status === 200, 'Deactivate returns 200');
  assert(res.data.isActive === false, 'User is now inactive');

  // 15. Filter inactive users
  console.log('\n15. Filter inactive users');
  res = await api('GET', '/admin/users?isActive=false');
  assert(res.status === 200, 'Filter inactive returns 200');
  assert(res.data.some((u) => u.id === testUserId), 'Deactivated user appears in inactive list');

  // ============================================
  // AUTHORIZATION CHECK
  // ============================================
  console.log('\n16. Authorization check — unauthenticated request');
  const noAuthToken = token;
  token = '';
  res = await api('GET', '/admin/users');
  assert(res.status === 401, 'Unauthenticated request returns 401');
  token = noAuthToken;

  // --- Summary ---
  console.log(`\n=== Results: ${passed} passed, ${failed} failed (${passed + failed} total) ===`);
  process.exit(failed > 0 ? 1 : 0);
};

run().catch((err) => {
  console.error('Test script crashed:', err);
  process.exit(1);
});
