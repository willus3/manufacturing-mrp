const authService = require('./auth.service');
const { sendSuccess } = require('../utils/response');

// Thin controller layer — each function calls the service and sends the response.
// Business logic lives in auth.service.js, not here.
// Errors are passed to next() and caught by the global error handler.

const login = async (req, res, next) => {
  try {
    const { email, password, tenantSlug } = req.body;
    const result = await authService.login(email, password, tenantSlug);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

const refresh = async (req, res, next) => {
  try {
    const result = await authService.refresh(req.body.refreshToken);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    const result = await authService.logout(req.user.userId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

const getMe = async (req, res, next) => {
  try {
    const result = await authService.getMe(req.user.userId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

module.exports = { login, refresh, logout, getMe };
