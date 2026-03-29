const { Router } = require('express');
const dashboardController = require('./dashboard.controller');
const { authenticate } = require('../middleware/authenticate');
const { tenantScope } = require('../middleware/tenantScope');

const router = Router();

// Dashboard is available to any authenticated user (no specific permission required)
router.use(authenticate, tenantScope);

router.get('/', dashboardController.getSummary);

module.exports = router;
