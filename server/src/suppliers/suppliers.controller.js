const suppliersService = require('./suppliers.service');
const { sendSuccess } = require('../utils/response');
const { listSuppliersQuery, createSupplierSchema } = require('./suppliers.validation');
const { parseAndValidate } = require('../utils/csvImport');
const { prisma } = require('../db');
const { AppError } = require('../utils/errors');

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

/** POST /suppliers/import — bulk import from CSV. */
const importSuppliers = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError(400, 'VALIDATION_ERROR', 'No CSV file uploaded');
    }

    const { valid, errors } = parseAndValidate(req.file.buffer, createSupplierSchema);

    let imported = 0;
    const skipped = [];

    if (valid.length > 0) {
      const rows = valid.map((row) => ({ ...row, tenantId: req.tenantId }));
      const result = await prisma.supplier.createMany({
        data: rows,
        skipDuplicates: true,
      });
      imported = result.count;

      const dupCount = valid.length - imported;
      if (dupCount > 0) {
        skipped.push(`${dupCount} row(s) skipped due to duplicate codes`);
      }
    }

    sendSuccess(res, {
      imported,
      skipped: skipped.length > 0 ? skipped : null,
      errors: errors.length > 0 ? errors : null,
      totalRows: valid.length + errors.length,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { list, getById, create, update, deactivate, importSuppliers };
