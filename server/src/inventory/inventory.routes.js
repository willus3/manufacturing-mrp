const { Router } = require('express');
const inventoryController = require('./inventory.controller');
const { validate } = require('../utils/validate');
const { adjustSchema, transferSchema } = require('./inventory.validation');
const { authenticate } = require('../middleware/authenticate');
const { tenantScope } = require('../middleware/tenantScope');
const { requirePermission } = require('../middleware/requirePermission');

const router = Router();

// All inventory routes require authentication and tenant scoping
router.use(authenticate, tenantScope);

// Read operations — require inventory:read
router.get('/stock', requirePermission('inventory:read'), inventoryController.listStock);
router.get('/stock/summary', requirePermission('inventory:read'), inventoryController.stockSummary);
router.get('/transactions', requirePermission('inventory:read'), inventoryController.listTransactions);

// Write operations — require inventory:write
router.post('/adjust', requirePermission('inventory:write'), validate(adjustSchema), inventoryController.adjust);
router.post('/transfer', requirePermission('inventory:write'), validate(transferSchema), inventoryController.transfer);

module.exports = router;
