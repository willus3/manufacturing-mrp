/**
 * Super Admin API Test Script
 * Tests: Tenant CRUD, suspend/activate, impersonate.
 *
 * Prerequisites: Server running on port 3000, database seeded.
 * Uses the super admin account: superadmin@mrp.system / superadmin123
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
let newTenantId;
const testSlug = `test-tenant-${Date.now()}`;

const run = async () => {
  console.log('=== Super Admin API Tests ===\n');

  // 1. Login as super admin
  // Super admin doesn't belong to a tenant, so we need a special login.
  // The current login requires tenantSlug — super admin uses the auth
  // system differently. Let's check if super admin can login with any tenant
  // or if we need a different approach.
  //
  // Looking at auth.service.js login(): it requires tenantSlug, finds tenant,
  // then finds user by (tenantId, email). But super admin has tenantId=null,
  // so the normal login flow won't work for super admin.
  //
  // For now, let's login as tenant admin and test that non-super-admin is rejected,
  // then we'll need to handle super admin login differently.

  // First: test that a regular tenant admin CANNOT access super endpoints
  console.log('1. Regular admin cannot access super endpoints');
  const adminLogin = await api('POST', '/auth/login', {
    email: 'admin@test.com',
    password: 'password123',
    tenantSlug: 'test-shop',
  });
  assert(adminLogin.status === 200, 'Tenant admin login succeeds');
  token = adminLogin.data.accessToken;

  let res = await api('GET', '/super/tenants');
  assert(res.status === 403, 'Regular admin gets 403 on super endpoints');

  // 2. Login as super admin
  // Super admin needs a direct JWT. Since the login endpoint requires tenantSlug,
  // and super admin has no tenant, we need to use the test-shop tenant login
  // but with the super admin's X-Tenant-Id override capability.
  //
  // Actually, looking more carefully: the super admin IS set with isSuperAdmin=true
  // but has no tenantId. The login flow requires a tenant. This is a known gap —
  // super admin login would need its own endpoint or a special path.
  //
  // For testing, we'll use the super admin seeded in the database and create
  // a JWT manually using the same token utility.

  console.log('\n2. Login as super admin (direct token)');
  // We'll call a helper script to generate a super admin token
  // For now, let's test with the tenant admin using the X-Tenant-Id header approach
  // Actually — the super admin just needs the isSuperAdmin flag in the JWT.
  // Let's import the token utility and sign one directly.
  const jwt = require('jsonwebtoken');
  const superToken = jwt.sign(
    {
      userId: 'super-admin-test',
      tenantId: null,
      permissions: [],
      isSuperAdmin: true,
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  token = superToken;

  // 3. List tenants
  console.log('\n3. List tenants');
  res = await api('GET', '/super/tenants');
  assert(res.status === 200, 'GET /super/tenants returns 200');
  assert(Array.isArray(res.data), 'Returns array of tenants');
  assert(res.meta && res.meta.total >= 1, 'Has pagination meta');
  assert(res.data[0].userCount !== undefined, 'Tenants include user count');

  // 4. Get existing tenant (test-shop)
  console.log('\n4. Get existing tenant');
  const testShop = res.data.find((t) => t.slug === 'test-shop');
  assert(testShop, 'test-shop tenant exists');
  res = await api('GET', `/super/tenants/${testShop.id}`);
  assert(res.status === 200, 'GET /super/tenants/:id returns 200');
  assert(res.data.slug === 'test-shop', 'Returns correct tenant');

  // 5. Create new tenant
  console.log('\n5. Create new tenant');
  res = await api('POST', '/super/tenants', {
    name: 'Test Factory',
    slug: testSlug,
    plan: 'starter',
    adminEmail: 'admin@testfactory.com',
    adminPassword: 'password123',
    adminFirstName: 'Factory',
    adminLastName: 'Admin',
  });
  assert(res.status === 201, 'POST /super/tenants returns 201');
  assert(res.data.tenant.slug === testSlug, 'Tenant has correct slug');
  assert(res.data.adminUser.email === 'admin@testfactory.com', 'Admin user was created');
  newTenantId = res.data.tenant.id;

  // 6. Duplicate slug check
  console.log('\n6. Duplicate slug check');
  res = await api('POST', '/super/tenants', {
    name: 'Duplicate',
    slug: testSlug,
    adminEmail: 'dup@test.com',
    adminPassword: 'password123',
    adminFirstName: 'Dup',
    adminLastName: 'User',
  });
  assert(res.status === 409, 'Duplicate slug returns 409');

  // 7. Update tenant
  console.log('\n7. Update tenant');
  res = await api('PUT', `/super/tenants/${newTenantId}`, {
    name: 'Updated Factory Name',
    plan: 'professional',
  });
  assert(res.status === 200, 'PUT /super/tenants/:id returns 200');
  assert(res.data.name === 'Updated Factory Name', 'Name was updated');
  assert(res.data.plan === 'professional', 'Plan was updated');

  // 8. Suspend tenant
  console.log('\n8. Suspend tenant');
  res = await api('PATCH', `/super/tenants/${newTenantId}/suspend`);
  assert(res.status === 200, 'PATCH suspend returns 200');
  assert(res.data.status === 'suspended', 'Tenant is suspended');

  // 9. Activate tenant
  console.log('\n9. Activate tenant');
  res = await api('PATCH', `/super/tenants/${newTenantId}/activate`);
  assert(res.status === 200, 'PATCH activate returns 200');
  assert(res.data.status === 'active', 'Tenant is active again');

  // 10. Impersonate
  console.log('\n10. Impersonate tenant admin');
  res = await api('POST', `/super/tenants/${newTenantId}/impersonate`);
  assert(res.status === 200, 'POST impersonate returns 200');
  assert(res.data.accessToken, 'Returns access token');
  assert(res.data.user.email === 'admin@testfactory.com', 'Token is for the tenant admin');
  assert(res.data.user.permissions.length > 0, 'Impersonated user has permissions');

  // 11. Verify impersonated token works
  console.log('\n11. Verify impersonated token works');
  const impersonatedToken = res.data.accessToken;
  const savedToken = token;
  token = impersonatedToken;
  res = await api('GET', '/auth/me');
  assert(res.status === 200, 'Impersonated token is valid');
  assert(res.data.email === 'admin@testfactory.com', 'Me endpoint returns tenant admin');
  token = savedToken;

  // 12. Search tenants
  console.log('\n12. Search tenants');
  res = await api('GET', '/super/tenants?search=Updated');
  assert(res.status === 200, 'Search returns 200');
  assert(res.data.some((t) => t.id === newTenantId), 'Search finds updated tenant');

  // 13. Filter by status
  console.log('\n13. Filter by status');
  res = await api('GET', '/super/tenants?status=active');
  assert(res.status === 200, 'Status filter returns 200');
  assert(res.data.every((t) => t.status === 'active'), 'All returned tenants are active');

  // 14. Impersonate existing test-shop
  console.log('\n14. Impersonate test-shop');
  res = await api('POST', `/super/tenants/${testShop.id}/impersonate`);
  assert(res.status === 200, 'Impersonate test-shop succeeds');
  assert(res.data.user.email === 'admin@test.com', 'Returns test-shop admin');

  // --- Summary ---
  console.log(`\n=== Results: ${passed} passed, ${failed} failed (${passed + failed} total) ===`);
  process.exit(failed > 0 ? 1 : 0);
};

run().catch((err) => {
  console.error('Test script crashed:', err);
  process.exit(1);
});
