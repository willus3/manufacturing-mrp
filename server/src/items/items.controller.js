const itemsService = require('./items.service');
const { sendSuccess } = require('../utils/response');
const { listItemsQuery } = require('./items.validation');

// GET /items — paginated list with filters
const list = async (req, res, next) => {
  try {
    // Validate and parse query params (with defaults)
    const query = listItemsQuery.parse(req.query);
    const { items, meta } = await itemsService.list(req.tenantId, query);
    sendSuccess(res, items, meta);
  } catch (err) {
    next(err);
  }
};

// GET /items/:id — single item
const getById = async (req, res, next) => {
  try {
    const item = await itemsService.getById(req.params.id, req.tenantId);
    sendSuccess(res, item);
  } catch (err) {
    next(err);
  }
};

// POST /items — create new item
const create = async (req, res, next) => {
  try {
    const item = await itemsService.create(req.body, req.tenantId);
    sendSuccess(res, item, null, 201);
  } catch (err) {
    next(err);
  }
};

// PUT /items/:id — update item
const update = async (req, res, next) => {
  try {
    const item = await itemsService.update(req.params.id, req.body, req.tenantId);
    sendSuccess(res, item);
  } catch (err) {
    next(err);
  }
};

// PATCH /items/:id/deactivate — soft disable
const deactivate = async (req, res, next) => {
  try {
    const item = await itemsService.deactivate(req.params.id, req.tenantId);
    sendSuccess(res, item);
  } catch (err) {
    next(err);
  }
};

module.exports = { list, getById, create, update, deactivate };
