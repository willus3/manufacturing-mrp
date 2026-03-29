const bcrypt = require('bcryptjs');
const { prisma } = require('../db');
const { notFoundError, conflictError, validationError, forbiddenError } = require('../utils/errors');

// ============================================
// LIST USERS — paginated, searchable
// ============================================
const listUsers = async (tenantId, query) => {
  const { search, isActive, page, pageSize, sort, order } = query;

  const where = { tenantId };

  if (isActive !== undefined) {
    where.isActive = isActive === 'true';
  }

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { [sort]: order },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        userRoles: {
          include: {
            role: { select: { id: true, name: true } },
          },
        },
      },
    }),
  ]);

  // Flatten userRoles → roles array for cleaner response
  const formatted = users.map((u) => ({
    ...u,
    roles: u.userRoles.map((ur) => ur.role),
    userRoles: undefined,
  }));

  const meta = {
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };

  return { users: formatted, meta };
};

// ============================================
// GET USER BY ID — single user with roles
// ============================================
const getUserById = async (id, tenantId) => {
  const user = await prisma.user.findFirst({
    where: { id, tenantId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      userRoles: {
        include: {
          role: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!user) {
    throw notFoundError('User not found');
  }

  return {
    ...user,
    roles: user.userRoles.map((ur) => ur.role),
    userRoles: undefined,
  };
};

// ============================================
// CREATE USER — hash password, assign roles
// ============================================
const createUser = async (data, tenantId) => {
  const { email, firstName, lastName, password, roleIds } = data;

  // Check email uniqueness within tenant
  const existing = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId, email } },
  });
  if (existing) {
    throw conflictError('A user with this email already exists');
  }

  // Verify all roleIds belong to this tenant
  const roles = await prisma.role.findMany({
    where: { id: { in: roleIds }, tenantId },
  });
  if (roles.length !== roleIds.length) {
    throw validationError('One or more role IDs are invalid');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      tenantId,
      email,
      firstName,
      lastName,
      passwordHash,
      userRoles: {
        create: roleIds.map((roleId) => ({ roleId })),
      },
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isActive: true,
      createdAt: true,
      userRoles: {
        include: {
          role: { select: { id: true, name: true } },
        },
      },
    },
  });

  return {
    ...user,
    roles: user.userRoles.map((ur) => ur.role),
    userRoles: undefined,
  };
};

// ============================================
// UPDATE USER — update fields + replace roles in a transaction
// ============================================
const updateUser = async (id, data, tenantId) => {
  // Verify user exists in this tenant
  await getUserById(id, tenantId);

  const { email, firstName, lastName, password, roleIds } = data;

  // If changing email, check uniqueness
  if (email) {
    const existing = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });
    if (existing && existing.id !== id) {
      throw conflictError('A user with this email already exists');
    }
  }

  // If changing roles, verify they belong to this tenant
  if (roleIds) {
    const roles = await prisma.role.findMany({
      where: { id: { in: roleIds }, tenantId },
    });
    if (roles.length !== roleIds.length) {
      throw validationError('One or more role IDs are invalid');
    }
  }

  // Build update data
  const updateData = {};
  if (email) updateData.email = email;
  if (firstName) updateData.firstName = firstName;
  if (lastName) updateData.lastName = lastName;
  if (password) updateData.passwordHash = await bcrypt.hash(password, 12);

  // Use transaction to update user + replace roles atomically
  const user = await prisma.$transaction(async (tx) => {
    // Update user fields
    if (Object.keys(updateData).length > 0) {
      await tx.user.update({ where: { id }, data: updateData });
    }

    // Replace role assignments if provided
    if (roleIds) {
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userRole.createMany({
        data: roleIds.map((roleId) => ({ userId: id, roleId })),
      });
    }

    // Return updated user with roles
    return tx.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        userRoles: {
          include: {
            role: { select: { id: true, name: true } },
          },
        },
      },
    });
  });

  return {
    ...user,
    roles: user.userRoles.map((ur) => ur.role),
    userRoles: undefined,
  };
};

// ============================================
// DEACTIVATE USER — can't deactivate yourself
// ============================================
const deactivateUser = async (id, tenantId, requestingUserId) => {
  if (id === requestingUserId) {
    throw validationError('Cannot deactivate your own account');
  }

  // Verify user exists
  await getUserById(id, tenantId);

  const user = await prisma.user.update({
    where: { id },
    data: {
      isActive: false,
      refreshTokenHash: null, // Force logout
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isActive: true,
    },
  });

  return user;
};

// ============================================
// LIST ROLES — with permission details
// ============================================
const listRoles = async (tenantId) => {
  const roles = await prisma.role.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' },
    include: {
      rolePermissions: {
        include: {
          permission: { select: { id: true, code: true, description: true } },
        },
      },
      _count: { select: { userRoles: true } },
    },
  });

  // Flatten rolePermissions → permissions array
  return roles.map((r) => ({
    id: r.id,
    name: r.name,
    isDefault: r.isDefault,
    createdAt: r.createdAt,
    userCount: r._count.userRoles,
    permissions: r.rolePermissions.map((rp) => rp.permission),
  }));
};

// ============================================
// CREATE ROLE — custom role (isDefault = false)
// ============================================
const createRole = async (data, tenantId) => {
  const { name, permissionIds } = data;

  // Check name uniqueness within tenant
  const existing = await prisma.role.findUnique({
    where: { tenantId_name: { tenantId, name } },
  });
  if (existing) {
    throw conflictError('A role with this name already exists');
  }

  // Verify all permissionIds exist
  const permissions = await prisma.permission.findMany({
    where: { id: { in: permissionIds } },
  });
  if (permissions.length !== permissionIds.length) {
    throw validationError('One or more permission IDs are invalid');
  }

  const role = await prisma.role.create({
    data: {
      tenantId,
      name,
      isDefault: false,
      rolePermissions: {
        create: permissionIds.map((permissionId) => ({ permissionId })),
      },
    },
    include: {
      rolePermissions: {
        include: {
          permission: { select: { id: true, code: true, description: true } },
        },
      },
    },
  });

  return {
    id: role.id,
    name: role.name,
    isDefault: role.isDefault,
    createdAt: role.createdAt,
    permissions: role.rolePermissions.map((rp) => rp.permission),
  };
};

// ============================================
// UPDATE ROLE — reject edits to default roles
// ============================================
const updateRole = async (id, data, tenantId) => {
  const role = await prisma.role.findFirst({ where: { id, tenantId } });
  if (!role) {
    throw notFoundError('Role not found');
  }

  if (role.isDefault) {
    throw forbiddenError('Default roles cannot be edited. Clone the role to customize it.');
  }

  const { name, permissionIds } = data;

  // If changing name, check uniqueness
  if (name && name !== role.name) {
    const existing = await prisma.role.findUnique({
      where: { tenantId_name: { tenantId, name } },
    });
    if (existing) {
      throw conflictError('A role with this name already exists');
    }
  }

  // If changing permissions, verify they exist
  if (permissionIds) {
    const permissions = await prisma.permission.findMany({
      where: { id: { in: permissionIds } },
    });
    if (permissions.length !== permissionIds.length) {
      throw validationError('One or more permission IDs are invalid');
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (name) {
      await tx.role.update({ where: { id }, data: { name } });
    }

    if (permissionIds) {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      await tx.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
      });
    }

    return tx.role.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          include: {
            permission: { select: { id: true, code: true, description: true } },
          },
        },
      },
    });
  });

  return {
    id: updated.id,
    name: updated.name,
    isDefault: updated.isDefault,
    createdAt: updated.createdAt,
    permissions: updated.rolePermissions.map((rp) => rp.permission),
  };
};

// ============================================
// LIST PERMISSIONS — all 18, global (not tenant-scoped)
// ============================================
const listPermissions = async () => {
  return prisma.permission.findMany({
    orderBy: { code: 'asc' },
    select: { id: true, code: true, description: true },
  });
};

module.exports = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deactivateUser,
  listRoles,
  createRole,
  updateRole,
  listPermissions,
};
