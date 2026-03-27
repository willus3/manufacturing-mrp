const { Router } = require('express');
const locationsController = require('./locations.controller');
const { validate } = require('../utils/validate');
const { createLocationSchema, updateLocationSchema } = require('./locations.validation');
const { authenticate } = require('../middleware/authenticate');
const { tenantScope } = require('../middleware/tenantScope');
const { requirePermission } = require('../middleware/requirePermission');

const router = Router();

// All location routes require authentication and tenant scoping
router.use(authenticate, tenantScope);

// Read operations — require inventory:read
router.get('/', requirePermission('inventory:read'), locationsController.list);
router.get('/:id', requirePermission('inventory:read'), locationsController.getById);

// Write operations — require inventory:write
router.post('/', requirePermission('inventory:write'), validate(createLocationSchema), locationsController.create);
router.put('/:id', requirePermission('inventory:write'), validate(updateLocationSchema), locationsController.update);
router.patch('/:id/deactivate', requirePermission('inventory:write'), locationsController.deactivate);

module.exports = router;
