const suppliersService = require('./suppliers.service');
const { sendSuccess } = require('../utils/response');
const { listSuppliersQuery } = require('./suppliers.validation');

/** GET /suppliers — paginated list with filters. */
const list = async (req, res, next) => {
  try {
    const query = listSuppliersQuery.parse(req.query);
    const { suppliers, meta } = await suppliersService.list(req.tenantId, query);
    sendSuccess(res, suppliers, meta);
  } catch (err) {
    next(err);
  }
};

/** GET /suppliers/:id — single supplier. */
const getById = async (req, res, next) => {
  try {
    const supplier = await suppliersService.getById(req.params.id, req.tenantId);
    sendSuccess(res, supplier);
  } catch (err) {
    next(err);
  }
};

/** POST /suppliers — create new supplier. */
const create = async (req, res, next) => {
  try {
    const supplier = await suppliersService.create(req.body, req.tenantId);
    sendSuccess(res, supplier, null, 201);
  } catch (err) {
    next(err);
  }
};

/** PUT /suppliers/:id — update supplier. */
const update = async (req, res, next) => {
  try {
    const supplier = await suppliersService.update(req.params.id, req.body, req.tenantId);
    sendSuccess(res, supplier);
  } catch (err) {
    next(err);
  }
};

/** PATCH /suppliers/:id/deactivate — soft disable. */
const deactivate = async (req, res, next) => {
  try {
    const supplier = await suppliersService.deactivate(req.params.id, req.tenantId);
    sendSuccess(res, supplier);
  } catch (err) {
    next(err);
  }
};

module.exports = { list, getById, create, update, deactivate };
