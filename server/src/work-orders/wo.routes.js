// Work Order routes — maps HTTP methods to controller handlers.
// Read ops need workorder:read, write ops need workorder:write,
// status changes need workorder:status.

const { Router } = require('express');
const woController = require('./wo.controller');
const { validate } = require('../utils/validate');
const { createWOSchema, updateWOSchema, statusChangeSchema, issueSchema } = require('./wo.validation');
const { authenticate } = require('../middleware/authenticate');
const { tenantScope } = require('../middleware/tenantScope');
const { requirePermission } = require('../middleware/requirePermission');

const router = Router();

// All WO routes require authentication and tenant scoping
router.use(authenticate, tenantScope);

// Read operations — require workorder:read
router.get('/', requirePermission('workorder:read'), woController.list);
router.get('/:id', requirePermission('workorder:read'), woController.getById);

// Write operations — require workorder:write
router.post('/', requirePermission('workorder:write'), validate(createWOSchema), woController.create);
router.put('/:id', requirePermission('workorder:write'), validate(updateWOSchema), woController.update);

// Status transitions — require workorder:status
router.patch('/:id/status', requirePermission('workorder:status'), validate(statusChangeSchema), woController.changeStatus);

// Material issue — require workorder:write (issuing material is a write operation)
router.post('/:id/issue', requirePermission('workorder:write'), validate(issueSchema), woController.issueMaterial);

module.exports = router;
