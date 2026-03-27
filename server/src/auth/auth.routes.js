const { Router } = require('express');
const authController = require('./auth.controller');
const { validate } = require('../utils/validate');
const { loginSchema, refreshSchema } = require('./auth.validation');
const { authenticate } = require('../middleware/authenticate');

const router = Router();

// Public routes — no authentication needed (these are the entry points)
router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshSchema), authController.refresh);

// Protected routes — require a valid JWT
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getMe);

module.exports = router;
