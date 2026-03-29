require('dotenv').config();
const BASE = 'http://localhost:3000/api/v1';

const run = async () => {
  // Login
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@test.com', password: 'password123', tenantSlug: 'test-shop' }),
  });
  const loginData = await loginRes.json();
  const token = loginData.data.accessToken;
  console.log('Token:', token ? 'OK' : 'MISSING');

  // Dashboard
  const dashRes = await fetch(`${BASE}/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('Status:', dashRes.status);
  const dashData = await dashRes.json();
  console.log('Response:', JSON.stringify(dashData, null, 2));
};

run().catch(console.error);
