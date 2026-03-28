// MRP controller — thin request/response layer.
// Parses + validates input, delegates to service, formats output.

const mrpService = require('./mrp.service');
const { sendSuccess } = require('../utils/response');
const {
  listDemandQuery,
  createDemandSchema,
  updateDemandSchema,
  runMrpSchema,
  listRunsQuery,
  listResultsQuery,
} = require('./mrp.validation');

// ============================================
// Demand endpoints
// ============================================

/** GET /mrp/demand — paginated demand list. */
const listDemand = async (req, res, next) => {
  try {
    const query = listDemandQuery.parse(req.query);
    const { demand, meta } = await mrpService.listDemand(req.tenantId, query);
    sendSuccess(res, demand, meta);
  } catch (err) {
    next(err);
  }
};

/** GET /mrp/demand/:id — single demand entry. */
const getDemand = async (req, res, next) => {
  try {
    const demand = await mrpService.getDemand(req.params.id, req.tenantId);
    sendSuccess(res, demand);
  } catch (err) {
    next(err);
  }
};

/** POST /mrp/demand — create demand entry. */
const createDemand = async (req, res, next) => {
  try {
    const demand = await mrpService.createDemand(req.body, req.tenantId, req.user.userId);
    sendSuccess(res, demand, null, 201);
  } catch (err) {
    next(err);
  }
};

/** PUT /mrp/demand/:id — update demand entry. */
const updateDemand = async (req, res, next) => {
  try {
    const demand = await mrpService.updateDemand(req.params.id, req.body, req.tenantId);
    sendSuccess(res, demand);
  } catch (err) {
    next(err);
  }
};

/** PATCH /mrp/demand/:id/cancel — cancel demand entry. */
const cancelDemand = async (req, res, next) => {
  try {
    const demand = await mrpService.cancelDemand(req.params.id, req.tenantId);
    sendSuccess(res, demand);
  } catch (err) {
    next(err);
  }
};

// ============================================
// MRP Run endpoints
// ============================================

/** POST /mrp/run — execute MRP calculation. */
const runMrp = async (req, res, next) => {
  try {
    const params = runMrpSchema.parse(req.body);
    const run = await mrpService.runMrp(req.tenantId, req.user.userId, params);
    sendSuccess(res, run, null, 201);
  } catch (err) {
    next(err);
  }
};

/** GET /mrp/runs — list MRP run history. */
const listRuns = async (req, res, next) => {
  try {
    const query = listRunsQuery.parse(req.query);
    const { runs, meta } = await mrpService.listRuns(req.tenantId, query);
    sendSuccess(res, runs, meta);
  } catch (err) {
    next(err);
  }
};

/** GET /mrp/runs/:id/results — results for a specific run. */
const getRunResults = async (req, res, next) => {
  try {
    const query = listResultsQuery.parse(req.query);
    const data = await mrpService.getRunResults(req.params.id, req.tenantId, query);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
};

/** POST /mrp/runs/:id/results/:resultId/convert — convert suggestion to PO or WO. */
const convertResult = async (req, res, next) => {
  try {
    const result = await mrpService.convertResult(
      req.params.id, req.params.resultId, req.tenantId, req.user.userId
    );
    sendSuccess(res, result, null, 201);
  } catch (err) {
    next(err);
  }
};

/** PATCH /mrp/runs/:id/results/:resultId/dismiss — dismiss a suggestion. */
const dismissResult = async (req, res, next) => {
  try {
    const result = await mrpService.dismissResult(req.params.id, req.params.resultId, req.tenantId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listDemand,
  getDemand,
  createDemand,
  updateDemand,
  cancelDemand,
  runMrp,
  listRuns,
  getRunResults,
  convertResult,
  dismissResult,
};
