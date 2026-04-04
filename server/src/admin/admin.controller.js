const adminService = require('./admin.service');
const { sendSuccess } = require('../utils/response');
const { listUsersQuery } = require('./admin.validation');

// GET /admin/users — paginated user list with roles
const listUsers = async (req, res, next) => {
  try {
    const query = listUsersQuery.parse(req.query);
    const { users, meta } = await adminService.listUsers(req.tenantId, query);
    sendSuccess(res, users, meta);
  } catch (err) {
    next(err);
  }
};

// GET /admin/users/:id — single user with roles
const getUser = async (req, res, next) => {
  try {
    const user = await adminService.getUserById(req.params.id, req.tenantId);
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
};

// POST /admin/users — create new user
const createUser = async (req, res, next) => {
  try {
    const user = await adminService.createUser(req.body, req.tenantId);
    sendSuccess(res, user, null, 201);
  } catch (err) {
    next(err);
  }
};

// PUT /admin/users/:id — update user
const updateUser = async (req, res, next) => {
  try {
    const user = await adminService.updateUser(req.params.id, req.body, req.tenantId);
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
};

// PATCH /admin/users/:id/deactivate — soft disable
const deactivateUser = async (req, res, next) => {
  try {
    const user = await adminService.deactivateUser(req.params.id, req.tenantId, req.user.userId);
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
};

// PATCH /admin/users/:id/reactivate — re-enable a deactivated user
const reactivateUser = async (req, res, next) => {
  try {
    const user = await adminService.reactivateUser(req.params.id, req.tenantId);
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
};

// GET /admin/roles — all roles with permissions
const listRoles = async (req, res, next) => {
  try {
    const roles = await adminService.listRoles(req.tenantId);
    sendSuccess(res, roles);
  } catch (err) {
    next(err);
  }
};

// POST /admin/roles — create custom role
const createRole = async (req, res, next) => {
  try {
    const role = await adminService.createRole(req.body, req.tenantId);
    sendSuccess(res, role, null, 201);
  } catch (err) {
    next(err);
  }
};

// PUT /admin/roles/:id — update role
const updateRole = async (req, res, next) => {
  try {
    const role = await adminService.updateRole(req.params.id, req.body, req.tenantId);
    sendSuccess(res, role);
  } catch (err) {
    next(err);
  }
};

// GET /admin/permissions — all 18 permissions
const listPermissions = async (req, res, next) => {
  try {
    const permissions = await adminService.listPermissions();
    sendSuccess(res, permissions);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deactivateUser,
  reactivateUser,
  listRoles,
  createRole,
  updateRole,
  listPermissions,
};
