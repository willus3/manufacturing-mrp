const superService = require('./super.service');
const { sendSuccess } = require('../utils/response');
const { listTenantsQuery } = require('./super.validation');

// GET /super/tenants — paginated tenant list
const listTenants = async (req, res, next) => {
  try {
    const query = listTenantsQuery.parse(req.query);
    const { tenants, meta } = await superService.listTenants(query);
    sendSuccess(res, tenants, meta);
  } catch (err) {
    next(err);
  }
};

// GET /super/tenants/:id — single tenant
const getTenant = async (req, res, next) => {
  try {
    const tenant = await superService.getTenantById(req.params.id);
    sendSuccess(res, tenant);
  } catch (err) {
    next(err);
  }
};

// POST /super/tenants — create tenant + admin user
const createTenant = async (req, res, next) => {
  try {
    const result = await superService.createTenant(req.body);
    sendSuccess(res, result, null, 201);
  } catch (err) {
    next(err);
  }
};

// PUT /super/tenants/:id — update tenant
const updateTenant = async (req, res, next) => {
  try {
    const tenant = await superService.updateTenant(req.params.id, req.body);
    sendSuccess(res, tenant);
  } catch (err) {
    next(err);
  }
};

// PATCH /super/tenants/:id/suspend — suspend tenant
const suspendTenant = async (req, res, next) => {
  try {
    const tenant = await superService.suspendTenant(req.params.id);
    sendSuccess(res, tenant);
  } catch (err) {
    next(err);
  }
};

// PATCH /super/tenants/:id/activate — activate tenant
const activateTenant = async (req, res, next) => {
  try {
    const tenant = await superService.activateTenant(req.params.id);
    sendSuccess(res, tenant);
  } catch (err) {
    next(err);
  }
};

// POST /super/tenants/:id/impersonate — get JWT as tenant admin
const impersonate = async (req, res, next) => {
  try {
    const result = await superService.impersonate(req.params.id);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listTenants,
  getTenant,
  createTenant,
  updateTenant,
  suspendTenant,
  activateTenant,
  impersonate,
};
