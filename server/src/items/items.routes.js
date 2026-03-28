const { Router } = require('express');
const multer = require('multer');
const itemsController = require('./items.controller');
const { validate } = require('../utils/validate');
const { createItemSchema, updateItemSchema } = require('./items.validation');
const { authenticate } = require('../middleware/authenticate');
const { tenantScope } = require('../middleware/tenantScope');
const { requirePermission } = require('../middleware/requirePermission');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

const router = Router();

// All item routes require authentication and tenant scoping
router.use(authenticate, tenantScope);

// Read operations — require item:read
router.get('/', requirePermission('item:read'), itemsController.list);
router.get('/:id', requirePermission('item:read'), itemsController.getById);

// Write operations — require item:write
router.post('/', requirePermission('item:write'), validate(createItemSchema), itemsController.create);
router.post('/import', requirePermission('item:write'), upload.single('file'), itemsController.importItems);
router.put('/:id', requirePermission('item:write'), validate(updateItemSchema), itemsController.update);
router.patch('/:id/deactivate', requirePermission('item:write'), itemsController.deactivate);

module.exports = router;
