// Tests all 4 auth endpoints in sequence.
// Run with: node scripts/test-auth.js
// Make sure the server is running on port 3000 first.

const BASE = 'http://localhost:3000/api/v1/auth';

const post = async (url, body) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
};

const get = async (url, token) => {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
};

const main = async () => {
  // === TEST 1: Login ===
  console.log('--- TEST 1: Login ---');
  const loginResult = await post(`${BASE}/login`, {
    email: 'admin@test.com',
    password: 'password123',
    tenantSlug: 'test-shop',
  });
  console.log('Status:', loginResult.error ? 'FAIL' : 'PASS');
  console.log('User:', loginResult.data?.user?.email);
  console.log('Has access token:', !!loginResult.data?.accessToken);
  console.log('Has refresh token:', !!loginResult.data?.refreshToken);
  console.log();

  const { accessToken, refreshToken } = loginResult.data;

  // === TEST 2: Get Me (with valid token) ===
  console.log('--- TEST 2: GET /me ---');
  const meResult = await get(`${BASE}/me`, accessToken);
  console.log('Status:', meResult.error ? 'FAIL' : 'PASS');
  console.log('User:', meResult.data?.email, meResult.data?.firstName, meResult.data?.lastName);
  console.log('Tenant:', meResult.data?.tenantName);
  console.log();

  // === TEST 3: Get Me (with bad token — should fail) ===
  console.log('--- TEST 3: GET /me with bad token ---');
  const badResult = await get(`${BASE}/me`, 'invalid-token-here');
  console.log('Status:', badResult.error ? 'PASS (correctly rejected)' : 'FAIL (should have rejected)');
  console.log('Error:', badResult.error?.code, '-', badResult.error?.message);
  console.log();

  // === TEST 4: Refresh token ===
  console.log('--- TEST 4: Refresh token ---');
  const refreshResult = await post(`${BASE}/refresh`, { refreshToken });
  console.log('Status:', refreshResult.error ? 'FAIL' : 'PASS');
  console.log('Has new access token:', !!refreshResult.data?.accessToken);
  console.log('Has new refresh token:', !!refreshResult.data?.refreshToken);
  console.log();

  // === TEST 5: Logout ===
  console.log('--- TEST 5: Logout ---');
  // Use the NEW access token from refresh (old one still works until it expires)
  const logoutResult = await post(`${BASE}/logout`, {});
  // Logout needs auth — let's send it properly
  const logoutRes = await fetch(`${BASE}/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${refreshResult.data.accessToken}`,
    },
  });
  const logoutData = await logoutRes.json();
  console.log('Status:', logoutData.error ? 'FAIL' : 'PASS');
  console.log('Success:', logoutData.data?.success);
  console.log();

  // === TEST 6: Refresh with old token (should fail after logout) ===
  console.log('--- TEST 6: Refresh after logout (should fail) ---');
  const staleRefresh = await post(`${BASE}/refresh`, {
    refreshToken: refreshResult.data.refreshToken,
  });
  console.log('Status:', staleRefresh.error ? 'PASS (correctly rejected)' : 'FAIL (should have rejected)');
  console.log('Error:', staleRefresh.error?.code, '-', staleRefresh.error?.message);
  console.log();

  console.log('=== All tests complete ===');
};

main().catch(console.error);
