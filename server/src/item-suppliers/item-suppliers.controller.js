const itemSuppliersService = require('./item-suppliers.service');
const { sendSuccess } = require('../utils/response');

/** GET /items/:itemId/suppliers — all linked suppliers for an item. */
const list = async (req, res, next) => {
  try {
    const links = await itemSuppliersService.list(req.params.itemId, req.tenantId);
    sendSuccess(res, links);
  } catch (err) {
    next(err);
  }
};

/** POST /items/:itemId/suppliers — link a supplier to an item. */
const create = async (req, res, next) => {
  try {
    const link = await itemSuppliersService.create(req.params.itemId, req.body, req.tenantId);
    sendSuccess(res, link, null, 201);
  } catch (err) {
    next(err);
  }
};

/** PUT /items/:itemId/suppliers/:supplierId — update the link. */
const update = async (req, res, next) => {
  try {
    const link = await itemSuppliersService.update(
      req.params.itemId,
      req.params.supplierId,
      req.body,
      req.tenantId
    );
    sendSuccess(res, link);
  } catch (err) {
    next(err);
  }
};

/** DELETE /items/:itemId/suppliers/:supplierId — remove the link. */
const remove = async (req, res, next) => {
  try {
    const result = await itemSuppliersService.remove(
      req.params.itemId,
      req.params.supplierId,
      req.tenantId
    );
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

module.exports = { list, create, update, remove };
