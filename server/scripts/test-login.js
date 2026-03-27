// Quick test: login as admin@test.com and check that permissions are in the response.
// Run with: node scripts/test-login.js
// Requires the server to be running on port 3000.

const main = async () => {
  const res = await fetch('http://localhost:3000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@test.com',
      password: 'password123',
      tenantSlug: 'test-shop',
    }),
  });

  const data = await res.json();
  console.log('Status:', res.status);
  console.log('User:', data.data?.user?.email);
  console.log('Permissions count:', data.data?.user?.permissions?.length);
  console.log('Permissions:', data.data?.user?.permissions);
};

main().catch(console.error);
