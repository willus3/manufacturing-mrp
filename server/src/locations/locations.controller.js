const locationsService = require('./locations.service');
const { sendSuccess } = require('../utils/response');
const { listLocationsQuery } = require('./locations.validation');

/** GET /locations — all locations for the tenant. */
const list = async (req, res, next) => {
  try {
    const query = listLocationsQuery.parse(req.query);
    const locations = await locationsService.list(req.tenantId, query);
    sendSuccess(res, locations);
  } catch (err) {
    next(err);
  }
};

/** GET /locations/:id — single location. */
const getById = async (req, res, next) => {
  try {
    const location = await locationsService.getById(req.params.id, req.tenantId);
    sendSuccess(res, location);
  } catch (err) {
    next(err);
  }
};

/** POST /locations — create new location. */
const create = async (req, res, next) => {
  try {
    const location = await locationsService.create(req.body, req.tenantId);
    sendSuccess(res, location, null, 201);
  } catch (err) {
    next(err);
  }
};

/** PUT /locations/:id — update location. */
const update = async (req, res, next) => {
  try {
    const location = await locationsService.update(req.params.id, req.body, req.tenantId);
    sendSuccess(res, location);
  } catch (err) {
    next(err);
  }
};

/** PATCH /locations/:id/deactivate — soft disable (fails if stock exists). */
const deactivate = async (req, res, next) => {
  try {
    const location = await locationsService.deactivate(req.params.id, req.tenantId);
    sendSuccess(res, location);
  } catch (err) {
    next(err);
  }
};

module.exports = { list, getById, create, update, deactivate };
