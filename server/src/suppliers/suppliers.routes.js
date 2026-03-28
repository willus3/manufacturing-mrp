const { Router } = require('express');
const multer = require('multer');
const suppliersController = require('./suppliers.controller');
const { validate } = require('../utils/validate');
const { createSupplierSchema, updateSupplierSchema } = require('./suppliers.validation');
const { authenticate } = require('../middleware/authenticate');
const { tenantScope } = require('../middleware/tenantScope');
const { requirePermission } = require('../middleware/requirePermission');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

const router = Router();

// All supplier routes require authentication and tenant scoping
router.use(authenticate, tenantScope);

// Read operations — require supplier:read
router.get('/', requirePermission('supplier:read'), suppliersController.list);
router.get('/:id', requirePermission('supplier:read'), suppliersController.getById);

// Write operations — require supplier:write
router.post('/', requirePermission('supplier:write'), validate(createSupplierSchema), suppliersController.create);
router.post('/import', requirePermission('supplier:write'), upload.single('file'), suppliersController.importSuppliers);
router.put('/:id', requirePermission('supplier:write'), validate(updateSupplierSchema), suppliersController.update);
router.patch('/:id/deactivate', requirePermission('supplier:write'), suppliersController.deactivate);

module.exports = router;
