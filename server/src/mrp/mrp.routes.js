// MRP routes — maps HTTP methods to controller handlers.
// All MRP operations require the mrp:run permission.

const { Router } = require('express');
const mrpController = require('./mrp.controller');
const { validate } = require('../utils/validate');
const { createDemandSchema, updateDemandSchema, runMrpSchema } = require('./mrp.validation');
const { authenticate } = require('../middleware/authenticate');
const { tenantScope } = require('../middleware/tenantScope');
const { requirePermission } = require('../middleware/requirePermission');

const router = Router();

// All MRP routes require authentication, tenant scoping, and mrp:run permission
router.use(authenticate, tenantScope, requirePermission('mrp:run'));

// Demand CRUD
router.get('/demand', mrpController.listDemand);
router.get('/demand/:id', mrpController.getDemand);
router.post('/demand', validate(createDemandSchema), mrpController.createDemand);
router.put('/demand/:id', validate(updateDemandSchema), mrpController.updateDemand);
router.patch('/demand/:id/cancel', mrpController.cancelDemand);

// MRP Run
router.post('/run', validate(runMrpSchema), mrpController.runMrp);
router.get('/runs', mrpController.listRuns);
router.get('/runs/:id/results', mrpController.getRunResults);

// Result actions
router.post('/runs/:id/results/:resultId/convert', mrpController.convertResult);
router.patch('/runs/:id/results/:resultId/dismiss', mrpController.dismissResult);

module.exports = router;
