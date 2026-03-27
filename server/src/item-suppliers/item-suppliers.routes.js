const { Router } = require('express');
const itemSuppliersController = require('./item-suppliers.controller');
const { validate } = require('../utils/validate');
const { createItemSupplierSchema, updateItemSupplierSchema } = require('./item-suppliers.validation');
const { authenticate } = require('../middleware/authenticate');
const { tenantScope } = require('../middleware/tenantScope');
const { requirePermission } = require('../middleware/requirePermission');

// mergeParams: true lets us access :itemId from the parent router
const router = Router({ mergeParams: true });

// All routes require authentication and tenant scoping
router.use(authenticate, tenantScope);

// Read — requires item:read (viewing an item's suppliers)
router.get('/', requirePermission('item:read'), itemSuppliersController.list);

// Write — requires both item:write and supplier:read
router.post('/', requirePermission('item:write'), validate(createItemSupplierSchema), itemSuppliersController.create);
router.put('/:supplierId', requirePermission('item:write'), validate(updateItemSupplierSchema), itemSuppliersController.update);
router.delete('/:supplierId', requirePermission('item:write'), itemSuppliersController.remove);

module.exports = router;
