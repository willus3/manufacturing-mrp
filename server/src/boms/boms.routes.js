const { Router } = require('express');
const bomsController = require('./boms.controller');
const { validate } = require('../utils/validate');
const { createBomSchema, updateBomSchema, changeStatusSchema } = require('./boms.validation');
const { authenticate } = require('../middleware/authenticate');
const { tenantScope } = require('../middleware/tenantScope');
const { requirePermission } = require('../middleware/requirePermission');

const router = Router();

// All BOM routes require authentication and tenant scoping
router.use(authenticate, tenantScope);

// Read operations — require bom:read
router.get('/', requirePermission('bom:read'), bomsController.list);
router.get('/:id', requirePermission('bom:read'), bomsController.getById);
router.get('/:id/tree', requirePermission('bom:read'), bomsController.getTree);

// Write operations — require bom:write
router.post('/', requirePermission('bom:write'), validate(createBomSchema), bomsController.create);
router.put('/:id', requirePermission('bom:write'), validate(updateBomSchema), bomsController.update);
router.patch('/:id/status', requirePermission('bom:write'), validate(changeStatusSchema), bomsController.changeStatus);
router.post('/:id/revise', requirePermission('bom:write'), bomsController.revise);

module.exports = router;
