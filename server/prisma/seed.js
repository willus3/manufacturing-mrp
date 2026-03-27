// Prisma seed script — run with: npx prisma db seed (from server/)
// Idempotent: safe to re-run without duplicating data.
//
// Seeds:
//   1. All 18 permissions (global, no tenant)
//   2. Test tenant "Test Shop"
//   3. 5 default roles with permission assignments for Test Shop
//   4. Tenant admin user (admin@test.com) with Admin role
//   5. Super admin user (superadmin@mrp.system) with NO tenant

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ============================================
// PERMISSIONS — 18 total, globally unique
// ============================================
const PERMISSIONS = [
  { code: 'bom:read', description: 'View BOMs' },
  { code: 'bom:write', description: 'Create/edit BOMs' },
  { code: 'bom:delete', description: 'Delete/archive BOMs' },
  { code: 'inventory:read', description: 'View inventory levels' },
  { code: 'inventory:write', description: 'Perform inventory transactions (receipts, adjustments, transfers)' },
  { code: 'item:read', description: 'View item master' },
  { code: 'item:write', description: 'Create/edit items' },
  { code: 'po:read', description: 'View purchase orders' },
  { code: 'po:write', description: 'Create/edit purchase orders' },
  { code: 'po:receive', description: 'Receive against purchase orders' },
  { code: 'supplier:read', description: 'View suppliers' },
  { code: 'supplier:write', description: 'Create/edit suppliers' },
  { code: 'workorder:read', description: 'View work orders' },
  { code: 'workorder:write', description: 'Create/edit work orders' },
  { code: 'workorder:status', description: 'Update work order status' },
  { code: 'mrp:run', description: 'Execute MRP calculation and manage demand' },
  { code: 'users:manage', description: 'Create/edit/deactivate users within the tenant' },
  { code: 'settings:manage', description: 'Configure tenant settings' },
];

// ============================================
// DEFAULT ROLES — per-tenant, isDefault: true
// "Admin" gets ALL permissions.
// ============================================
const DEFAULT_ROLES = [
  {
    name: 'Admin',
    permissions: 'ALL',
  },
  {
    name: 'Production Manager',
    permissions: [
      'bom:read', 'bom:write',
      'workorder:read', 'workorder:write', 'workorder:status',
      'inventory:read',
      'mrp:run',
      'po:read',
      'item:read', 'item:write',
    ],
  },
  {
    name: 'Purchasing Agent',
    permissions: [
      'po:read', 'po:write', 'po:receive',
      'supplier:read', 'supplier:write',
      'inventory:read',
      'bom:read',
      'item:read', 'item:write',
    ],
  },
  {
    name: 'Shop Floor Supervisor',
    permissions: [
      'workorder:read', 'workorder:status',
      'bom:read',
      'inventory:read',
      'item:read',
    ],
  },
  {
    name: 'Inventory Clerk',
    permissions: [
      'inventory:read', 'inventory:write',
      'item:read',
      'bom:read',
    ],
  },
];

const main = async () => {
  console.log('Seeding database...\n');

  // ---- 1. Seed permissions ----
  console.log('1. Seeding permissions...');
  const permissionRecords = {};
  for (const perm of PERMISSIONS) {
    const record = await prisma.permission.upsert({
      where: { code: perm.code },
      update: { description: perm.description },
      create: perm,
    });
    permissionRecords[perm.code] = record;
  }
  console.log(`   ${Object.keys(permissionRecords).length} permissions seeded.`);

  // ---- 2. Create test tenant ----
  console.log('2. Creating test tenant...');
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'test-shop' },
    update: {},
    create: { name: 'Test Shop', slug: 'test-shop' },
  });
  console.log(`   Tenant: ${tenant.name} (${tenant.id})`);

  // ---- 3. Create default roles with permission assignments ----
  console.log('3. Creating default roles...');
  const allPermissionCodes = PERMISSIONS.map((p) => p.code);

  for (const roleDef of DEFAULT_ROLES) {
    // Resolve which permission codes this role gets
    const permCodes = roleDef.permissions === 'ALL'
      ? allPermissionCodes
      : roleDef.permissions;

    // Upsert the role
    const role = await prisma.role.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: roleDef.name } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: roleDef.name,
        isDefault: true,
      },
    });

    // Clear existing permission assignments and re-create them
    // This ensures the role's permissions always match the spec
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permCodes.map((code) => ({
        roleId: role.id,
        permissionId: permissionRecords[code].id,
      })),
    });

    console.log(`   ${roleDef.name}: ${permCodes.length} permissions`);
  }

  // ---- 4. Create tenant admin user with Admin role ----
  console.log('4. Creating tenant admin user...');
  const adminPasswordHash = await bcrypt.hash('password123', 12);

  const adminUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@test.com' } },
    update: { passwordHash: adminPasswordHash },
    create: {
      tenantId: tenant.id,
      email: 'admin@test.com',
      passwordHash: adminPasswordHash,
      firstName: 'Test',
      lastName: 'Admin',
    },
  });

  // Assign Admin role to the tenant admin
  const adminRole = await prisma.role.findUnique({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Admin' } },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
    update: {},
    create: { userId: adminUser.id, roleId: adminRole.id },
  });
  console.log(`   admin@test.com / password123 → Admin role`);

  // ---- 5. Create super admin (NO tenant) ----
  console.log('5. Creating super admin user...');
  const superPasswordHash = await bcrypt.hash('superadmin123', 12);

  // Super admin exists outside all tenants (tenantId is null).
  // The unique constraint is (tenantId, email), but SQL treats NULLs as distinct,
  // so we search all users with this email and pick the one with no tenant.
  const allWithEmail = await prisma.user.findMany({
    where: { email: 'superadmin@mrp.system' },
  });
  const existingSuperAdmin = allWithEmail.find((u) => u.tenantId === null);

  if (existingSuperAdmin) {
    await prisma.user.update({
      where: { id: existingSuperAdmin.id },
      data: { passwordHash: superPasswordHash, isSuperAdmin: true },
    });
    console.log(`   superadmin@mrp.system (updated)`);
  } else {
    await prisma.user.create({
      data: {
        tenantId: null,
        email: 'superadmin@mrp.system',
        passwordHash: superPasswordHash,
        firstName: 'Super',
        lastName: 'Admin',
        isSuperAdmin: true,
      },
    });
    console.log(`   superadmin@mrp.system / superadmin123 (created)`);
  }

  console.log('\nSeed complete!');
};

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
