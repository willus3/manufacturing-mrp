const bomsService = require('./boms.service');
const { sendSuccess } = require('../utils/response');
const { listBomsQuery } = require('./boms.validation');

/** GET /boms — paginated list with filters. */
const list = async (req, res, next) => {
  try {
    const query = listBomsQuery.parse(req.query);
    const { boms, meta } = await bomsService.list(req.tenantId, query);
    sendSuccess(res, boms, meta);
  } catch (err) {
    next(err);
  }
};

/** GET /boms/:id — single BOM with lines. */
const getById = async (req, res, next) => {
  try {
    const bom = await bomsService.getById(req.params.id, req.tenantId);
    sendSuccess(res, bom);
  } catch (err) {
    next(err);
  }
};

/** GET /boms/:id/tree — multi-level exploded tree. */
const getTree = async (req, res, next) => {
  try {
    const tree = await bomsService.getTree(req.params.id, req.tenantId);
    sendSuccess(res, tree);
  } catch (err) {
    next(err);
  }
};

/** POST /boms — create BOM with lines. */
const create = async (req, res, next) => {
  try {
    const bom = await bomsService.create(req.body, req.tenantId);
    sendSuccess(res, bom, null, 201);
  } catch (err) {
    next(err);
  }
};

/** PUT /boms/:id — update BOM header and/or lines. */
const update = async (req, res, next) => {
  try {
    const bom = await bomsService.update(req.params.id, req.body, req.tenantId);
    sendSuccess(res, bom);
  } catch (err) {
    next(err);
  }
};

/** PATCH /boms/:id/status — change BOM status. */
const changeStatus = async (req, res, next) => {
  try {
    const bom = await bomsService.changeStatus(req.params.id, req.body.status, req.tenantId);
    sendSuccess(res, bom);
  } catch (err) {
    next(err);
  }
};

/** POST /boms/:id/revise — create new revision from active BOM. */
const revise = async (req, res, next) => {
  try {
    const bom = await bomsService.revise(req.params.id, req.tenantId);
    sendSuccess(res, bom, null, 201);
  } catch (err) {
    next(err);
  }
};

module.exports = { list, getById, getTree, create, update, changeStatus, revise };
