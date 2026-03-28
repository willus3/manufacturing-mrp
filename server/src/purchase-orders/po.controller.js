// Purchase Order controller — thin request/response layer.
// Parses + validates input, delegates to service, formats output.

const poService = require('./po.service');
const { sendSuccess } = require('../utils/response');
const { listPOQuery } = require('./po.validation');

/** GET /purchase-orders — paginated list with filters. */
const list = async (req, res, next) => {
  try {
    const query = listPOQuery.parse(req.query);
    const { purchaseOrders, meta } = await poService.list(req.tenantId, query);
    sendSuccess(res, purchaseOrders, meta);
  } catch (err) {
    next(err);
  }
};

/** GET /purchase-orders/:id — single PO with lines + receipts. */
const getById = async (req, res, next) => {
  try {
    const po = await poService.getById(req.params.id, req.tenantId);
    sendSuccess(res, po);
  } catch (err) {
    next(err);
  }
};

/** POST /purchase-orders — create new PO with lines. */
const create = async (req, res, next) => {
  try {
    const po = await poService.create(req.body, req.tenantId, req.user.userId);
    sendSuccess(res, po, null, 201);
  } catch (err) {
    next(err);
  }
};

/** PUT /purchase-orders/:id — update draft PO. */
const update = async (req, res, next) => {
  try {
    const po = await poService.update(req.params.id, req.body, req.tenantId);
    sendSuccess(res, po);
  } catch (err) {
    next(err);
  }
};

/** PATCH /purchase-orders/:id/send — mark as sent. */
const send = async (req, res, next) => {
  try {
    const po = await poService.send(req.params.id, req.tenantId);
    sendSuccess(res, po);
  } catch (err) {
    next(err);
  }
};

/** PATCH /purchase-orders/:id/cancel — cancel PO. */
const cancel = async (req, res, next) => {
  try {
    const po = await poService.cancel(req.params.id, req.tenantId);
    sendSuccess(res, po);
  } catch (err) {
    next(err);
  }
};

/** POST /purchase-orders/:id/receive — receive items against PO lines. */
const receive = async (req, res, next) => {
  try {
    const result = await poService.receive(req.params.id, req.body, req.tenantId, req.user.userId);
    sendSuccess(res, result, null, 201);
  } catch (err) {
    next(err);
  }
};

module.exports = { list, getById, create, update, send, cancel, receive };
