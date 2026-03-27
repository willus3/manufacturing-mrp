// Quick verification script — checks that seed data is correct.
// Run with: node scripts/verify-seed.js

require('dotenv').config();
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const main = async () => {
  // 1. Check permissions
  const permissions = await prisma.permission.findMany();
  console.log(`Permissions: ${permissions.length} (expected 18)`);

  // 2. Check tenant
  const tenant = await prisma.tenant.findUnique({ where: { slug: 'test-shop' } });
  console.log(`Tenant: ${tenant ? tenant.name : 'MISSING'}`);

  // 3. Check roles and their permission counts
  const roles = await prisma.role.findMany({
    where: { tenantId: tenant.id },
    include: { rolePermissions: true },
  });
  console.log(`\nRoles (${roles.length}):`);
  for (const role of roles) {
    console.log(`  ${role.name}: ${role.rolePermissions.length} permissions, isDefault=${role.isDefault}`);
  }

  // 4. Check tenant admin user and their roles
  const adminUser = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@test.com' } },
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: { include: { permission: true } },
            },
          },
        },
      },
    },
  });
  const adminPerms = new Set();
  for (const ur of adminUser.userRoles) {
    for (const rp of ur.role.rolePermissions) {
      adminPerms.add(rp.permission.code);
    }
  }
  console.log(`\nAdmin user: ${adminUser.email}`);
  console.log(`  Roles: ${adminUser.userRoles.map((ur) => ur.role.name).join(', ')}`);
  console.log(`  Permissions: ${adminPerms.size} (expected 18)`);
  console.log(`  isSuperAdmin: ${adminUser.isSuperAdmin} (expected false)`);
  console.log(`  tenantId: ${adminUser.tenantId} (should be set)`);

  // 5. Check super admin
  const allUsers = await prisma.user.findMany({ where: { email: 'superadmin@mrp.system' } });
  const superAdmin = allUsers.find((u) => u.tenantId === null);
  console.log(`\nSuper admin: ${superAdmin ? superAdmin.email : 'MISSING'}`);
  console.log(`  isSuperAdmin: ${superAdmin ? superAdmin.isSuperAdmin : 'N/A'} (expected true)`);
  console.log(`  tenantId: ${superAdmin ? superAdmin.tenantId : 'N/A'} (expected null)`);

  await prisma.$disconnect();
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
