const { Router } = require('express');
const superController = require('./super.controller');
const { validate } = require('../utils/validate');
const { createTenantSchema, updateTenantSchema } = require('./super.validation');
const { authenticate } = require('../middleware/authenticate');
const { requireSuperAdmin } = require('../middleware/requireSuperAdmin');

const router = Router();

// All super admin routes require authentication + super admin check (no tenant scoping)
router.use(authenticate, requireSuperAdmin);

// Tenant management
router.get('/tenants', superController.listTenants);
router.get('/tenants/:id', superController.getTenant);
router.post('/tenants', validate(createTenantSchema), superController.createTenant);
router.put('/tenants/:id', validate(updateTenantSchema), superController.updateTenant);
router.patch('/tenants/:id/suspend', superController.suspendTenant);
router.patch('/tenants/:id/activate', superController.activateTenant);
router.post('/tenants/:id/impersonate', superController.impersonate);

module.exports = router;
