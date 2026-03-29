const { Router } = require('express');
const adminController = require('./admin.controller');
const { validate } = require('../utils/validate');
const { createUserSchema, updateUserSchema, createRoleSchema, updateRoleSchema } = require('./admin.validation');
const { authenticate } = require('../middleware/authenticate');
const { tenantScope } = require('../middleware/tenantScope');
const { requirePermission } = require('../middleware/requirePermission');

const router = Router();

// All admin routes require authentication, tenant scoping, and users:manage permission
router.use(authenticate, tenantScope, requirePermission('users:manage'));

// User management
router.get('/users', adminController.listUsers);
router.get('/users/:id', adminController.getUser);
router.post('/users', validate(createUserSchema), adminController.createUser);
router.put('/users/:id', validate(updateUserSchema), adminController.updateUser);
router.patch('/users/:id/deactivate', adminController.deactivateUser);

// Role management
router.get('/roles', adminController.listRoles);
router.post('/roles', validate(createRoleSchema), adminController.createRole);
router.put('/roles/:id', validate(updateRoleSchema), adminController.updateRole);

// Permissions (read-only reference)
router.get('/permissions', adminController.listPermissions);

module.exports = router;
