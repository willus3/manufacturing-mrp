// Purchase Order routes — maps HTTP methods to controller handlers.
// Read ops need po:read, write ops need po:write.

const { Router } = require('express');
const poController = require('./po.controller');
const { validate } = require('../utils/validate');
const { createPOSchema, updatePOSchema, receiveSchema } = require('./po.validation');
const { authenticate } = require('../middleware/authenticate');
const { tenantScope } = require('../middleware/tenantScope');
const { requirePermission } = require('../middleware/requirePermission');

const router = Router();

// All PO routes require authentication and tenant scoping
router.use(authenticate, tenantScope);

// Read operations — require po:read
router.get('/', requirePermission('po:read'), poController.list);
router.get('/:id', requirePermission('po:read'), poController.getById);

// Write operations — require po:write
router.post('/', requirePermission('po:write'), validate(createPOSchema), poController.create);
router.put('/:id', requirePermission('po:write'), validate(updatePOSchema), poController.update);
router.patch('/:id/send', requirePermission('po:write'), poController.send);
router.patch('/:id/cancel', requirePermission('po:write'), poController.cancel);
router.post('/:id/receive', requirePermission('po:receive'), validate(receiveSchema), poController.receive);

module.exports = router;
