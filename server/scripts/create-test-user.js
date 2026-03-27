// Quick script to create a test tenant and user for development.
// Run with: node scripts/create-test-user.js
// Then delete this file when no longer needed.

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const main = async () => {
  // Create a test tenant
  const tenant = await prisma.tenant.create({
    data: { name: 'Test Shop', slug: 'test-shop' },
  });
  console.log('Created tenant:', tenant.id, '(Test Shop)');

  // Create a test user with password "password123"
  const hash = await bcrypt.hash('password123', 12);
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'admin@test.com',
      passwordHash: hash,
      firstName: 'Test',
      lastName: 'Admin',
    },
  });
  console.log('Created user:', user.id, '(admin@test.com / password123)');

  await prisma.$disconnect();
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
