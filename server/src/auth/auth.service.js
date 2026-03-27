const bcrypt = require('bcryptjs');
const { prisma } = require('../db');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/tokens');
const { unauthorizedError } = require('../utils/errors');

// Load a user's permissions by traversing: User → UserRole → Role → RolePermission → Permission
// Returns a flat array of unique permission code strings, e.g. ['bom:read', 'item:write']
const loadUserPermissions = async (userId) => {
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: {
      role: {
        include: {
          rolePermissions: {
            include: { permission: true },
          },
        },
      },
    },
  });

  // Flatten the nested structure into a unique set of permission codes
  const permissionSet = new Set();
  for (const ur of userRoles) {
    for (const rp of ur.role.rolePermissions) {
      permissionSet.add(rp.permission.code);
    }
  }

  return [...permissionSet];
};

// Hash a refresh token before storing in the database.
// Uses fewer rounds than passwords since this is just for verification, not security-critical hashing.
const hashRefreshToken = async (token) => {
  return bcrypt.hash(token, 6);
};

// ============================================
// LOGIN
// ============================================
// 1. Look up tenant by slug
// 2. Find user by email within that tenant
// 3. Verify password
// 4. Load permissions
// 5. Issue access + refresh tokens
// 6. Store hashed refresh token and update lastLoginAt
const login = async (email, password, tenantSlug) => {
  // Find the tenant
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
  });

  if (!tenant || tenant.status === 'suspended') {
    throw unauthorizedError('Invalid credentials');
  }

  // Find the user within this tenant
  const user = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email } },
  });

  if (!user || !user.isActive) {
    throw unauthorizedError('Invalid credentials');
  }

  // Verify password
  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    // Same generic message for all auth failures — don't reveal whether
    // the email exists or the password was wrong (prevents enumeration)
    throw unauthorizedError('Invalid credentials');
  }

  // Load permissions from the role/permission tables
  const permissions = await loadUserPermissions(user.id);

  // Build JWT payload
  const tokenPayload = {
    userId: user.id,
    tenantId: tenant.id,
    permissions,
    isSuperAdmin: user.isSuperAdmin,
  };

  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken({ userId: user.id });

  // Store hashed refresh token and update last login time
  await prisma.user.update({
    where: { id: user.id },
    data: {
      refreshTokenHash: await hashRefreshToken(refreshToken),
      lastLoginAt: new Date(),
    },
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      tenantId: tenant.id,
      tenantName: tenant.name,
      permissions,
    },
  };
};

// ============================================
// REFRESH
// ============================================
// Token rotation: issues new access + refresh tokens, invalidates the old refresh token.
// If someone steals a refresh token and the real user also refreshes,
// one of them will get a mismatch — signaling a potential compromise.
const refresh = async (refreshToken) => {
  // Verify the refresh token signature and expiry
  const decoded = verifyRefreshToken(refreshToken);

  // Look up the user
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    include: { tenant: true },
  });

  if (!user || !user.isActive) {
    throw unauthorizedError('Invalid refresh token');
  }

  if (user.tenant.status === 'suspended') {
    throw unauthorizedError('Tenant is suspended');
  }

  // Verify this refresh token matches what's stored (catches rotated/revoked tokens)
  if (!user.refreshTokenHash) {
    throw unauthorizedError('No active session');
  }

  const tokenValid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
  if (!tokenValid) {
    throw unauthorizedError('Invalid refresh token');
  }

  // Load fresh permissions (they may have changed since last login)
  const permissions = await loadUserPermissions(user.id);

  // Issue new tokens
  const tokenPayload = {
    userId: user.id,
    tenantId: user.tenantId,
    permissions,
    isSuperAdmin: user.isSuperAdmin,
  };

  const newAccessToken = signAccessToken(tokenPayload);
  const newRefreshToken = signRefreshToken({ userId: user.id });

  // Rotate: store the new refresh token hash, invalidating the old one
  await prisma.user.update({
    where: { id: user.id },
    data: {
      refreshTokenHash: await hashRefreshToken(newRefreshToken),
    },
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

// ============================================
// LOGOUT
// ============================================
// Clears the stored refresh token hash — the user's refresh token
// will no longer match anything, effectively ending the session.
const logout = async (userId) => {
  await prisma.user.update({
    where: { id: userId },
    data: { refreshTokenHash: null },
  });

  return { success: true };
};

// ============================================
// GET ME
// ============================================
// Returns the current user's profile and permissions.
// Used by the frontend to know who's logged in and what they can do.
const getMe = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { tenant: true },
  });

  if (!user) {
    throw unauthorizedError('User not found');
  }

  const permissions = await loadUserPermissions(user.id);

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    isActive: user.isActive,
    isSuperAdmin: user.isSuperAdmin,
    tenantId: user.tenantId,
    tenantName: user.tenant.name,
    tenantSlug: user.tenant.slug,
    permissions,
  };
};

module.exports = { login, refresh, logout, getMe };
