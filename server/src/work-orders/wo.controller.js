// Work Order controller — thin request/response layer.
// Parses + validates input, delegates to service, formats output.

const woService = require('./wo.service');
const { sendSuccess } = require('../utils/response');
const { listWOQuery } = require('./wo.validation');

/** GET /work-orders — paginated list with filters. */
const list = async (req, res, next) => {
  try {
    const query = listWOQuery.parse(req.query);
    const { workOrders, meta } = await woService.list(req.tenantId, query);
    sendSuccess(res, workOrders, meta);
  } catch (err) {
    next(err);
  }
};

/** GET /work-orders/:id — single WO with lines. */
const getById = async (req, res, next) => {
  try {
    const wo = await woService.getById(req.params.id, req.tenantId);
    sendSuccess(res, wo);
  } catch (err) {
    next(err);
  }
};

/** POST /work-orders — create new WO from BOM. */
const create = async (req, res, next) => {
  try {
    const wo = await woService.create(req.body, req.tenantId, req.user.userId);
    sendSuccess(res, wo, null, 201);
  } catch (err) {
    next(err);
  }
};

/** PUT /work-orders/:id — update planned WO. */
const update = async (req, res, next) => {
  try {
    const wo = await woService.update(req.params.id, req.body, req.tenantId);
    sendSuccess(res, wo);
  } catch (err) {
    next(err);
  }
};

/** PATCH /work-orders/:id/status — change WO status. */
const changeStatus = async (req, res, next) => {
  try {
    const result = await woService.changeStatus(req.params.id, req.body.status, req.tenantId, req.user.userId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

/** POST /work-orders/:id/issue — issue material from inventory. */
const issueMaterial = async (req, res, next) => {
  try {
    const result = await woService.issueMaterial(req.params.id, req.body, req.tenantId, req.user.userId);
    sendSuccess(res, result, null, 201);
  } catch (err) {
    next(err);
  }
};

module.exports = { list, getById, create, update, changeStatus, issueMaterial };
