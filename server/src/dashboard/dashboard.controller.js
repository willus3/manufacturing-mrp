const dashboardService = require('./dashboard.service');
const { sendSuccess } = require('../utils/response');

// GET /dashboard — all summary data for the dashboard
const getSummary = async (req, res, next) => {
  try {
    const summary = await dashboardService.getDashboardSummary(req.tenantId);
    sendSuccess(res, summary);
  } catch (err) {
    next(err);
  }
};

module.exports = { getSummary };
