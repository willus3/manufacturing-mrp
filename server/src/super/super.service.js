const bcrypt = require('bcryptjs');
const { prisma } = require('../db');
const { notFoundError, conflictError } = require('../utils/errors');
const { signAccessToken, signRefreshToken } = require('../utils/tokens');
const { loadUserPermissions } = require('../auth/auth.service');
const { PERMISSIONS, DEFAULT_ROLES } = require('../utils/defaultRoles');

// ============================================
// LIST TENANTS — paginated, searchable (no tenant scoping)
// ============================================
const listTenants = async (query) => {
  const { search, status, page, pageSize, sort, order } = query;

  const where = {};

  if (status) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [total, tenants] = await Promise.all([
    prisma.tenant.count({ where }),
    prisma.tenant.findMany({
      where,
      orderBy: { [sort]: order },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        _count: { select: { users: true } },
      },
    }),
  ]);

  const formatted = tenants.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    status: t.status,
    plan: t.plan,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    userCount: t._count.users,
  }));

  const meta = {
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };

  return { tenants: formatted, meta };
};

// ============================================
// GET TENANT BY ID
// ============================================
const getTenantById = async (id) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      _count: { select: { users: true } },
    },
  });

  if (!tenant) {
    throw notFoundError('Tenant not found');
  }

  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    status: tenant.status,
    plan: tenant.plan,
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
    userCount: tenant._count.users,
  };
};

// ============================================
// CREATE TENANT — with default roles + initial admin user
// ============================================
const createTenant = async (data) => {
  const { name, slug, plan, adminEmail, adminPassword, adminFirstName, adminLastName } = data;

  // Check slug uniqueness
  const existing = await prisma.tenant.findUnique({ where: { slug } });
  if (existing) {
    throw conflictError('A tenant with this slug already exists');
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  // Transaction: create tenant → permissions check → default roles → admin user → assign Admin role
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create tenant
    const tenant = await tx.tenant.create({
      data: { name, slug, plan, status: 'active' },
    });

    // 2. Get all permission records (global, already seeded)
    const allPermissions = await tx.permission.findMany();
    const permissionsByCode = {};
    for (const p of allPermissions) {
      permissionsByCode[p.code] = p;
    }

    // 3. Create default roles with permission assignments
    const allPermissionCodes = PERMISSIONS.map((p) => p.code);
    let adminRole = null;

    for (const roleDef of DEFAULT_ROLES) {
      const permCodes = roleDef.permissions === 'ALL' ? allPermissionCodes : roleDef.permissions;

      const role = await tx.role.create({
        data: {
          tenantId: tenant.id,
          name: roleDef.name,
          isDefault: true,
          rolePermissions: {
            create: permCodes.map((code) => ({
              permissionId: permissionsByCode[code].id,
            })),
          },
        },
      });

      if (roleDef.name === 'Admin') {
        adminRole = role;
      }
    }

    // 4. Create admin user and assign Admin role
    const adminUser = await tx.user.create({
      data: {
        tenantId: tenant.id,
        email: adminEmail,
        passwordHash,
        firstName: adminFirstName,
        lastName: adminLastName,
        userRoles: {
          create: { roleId: adminRole.id },
        },
      },
    });

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        plan: tenant.plan,
        createdAt: tenant.createdAt,
      },
      adminUser: {
        id: adminUser.id,
        email: adminUser.email,
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
      },
    };
  });

  return result;
};

// ============================================
// UPDATE TENANT
// ============================================
const updateTenant = async (id, data) => {
  await getTenantById(id);

  const tenant = await prisma.tenant.update({
    where: { id },
    data,
  });

  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    status: tenant.status,
    plan: tenant.plan,
    updatedAt: tenant.updatedAt,
  };
};

// ============================================
// SUSPEND TENANT
// ============================================
const suspendTenant = async (id) => {
  await getTenantById(id);

  const tenant = await prisma.tenant.update({
    where: { id },
    data: { status: 'suspended' },
  });

  return { id: tenant.id, name: tenant.name, status: tenant.status };
};

// ============================================
// ACTIVATE TENANT
// ============================================
const activateTenant = async (id) => {
  await getTenantById(id);

  const tenant = await prisma.tenant.update({
    where: { id },
    data: { status: 'active' },
  });

  return { id: tenant.id, name: tenant.name, status: tenant.status };
};

// ============================================
// IMPERSONATE — generate a JWT as the tenant's admin
// ============================================
const impersonate = async (tenantId) => {
  await getTenantById(tenantId);

  // Find the first active user with the Admin role in this tenant
  const adminUserRole = await prisma.userRole.findFirst({
    where: {
      user: { tenantId, isActive: true },
      role: { tenantId, name: 'Admin' },
    },
    include: {
      user: true,
    },
  });

  if (!adminUserRole) {
    throw notFoundError('No active admin user found for this tenant');
  }

  const user = adminUserRole.user;
  const permissions = await loadUserPermissions(user.id);

  const tokenPayload = {
    userId: user.id,
    tenantId,
    permissions,
    isSuperAdmin: false, // Impersonation drops super admin privileges
  };

  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken({ userId: user.id });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      tenantId,
      permissions,
    },
  };
};

module.exports = {
  listTenants,
  getTenantById,
  createTenant,
  updateTenant,
  suspendTenant,
  activateTenant,
  impersonate,
};
