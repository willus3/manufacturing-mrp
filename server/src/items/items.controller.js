const itemsService = require('./items.service');
const { sendSuccess } = require('../utils/response');
const { listItemsQuery, createItemSchema } = require('./items.validation');
const { parseAndValidate } = require('../utils/csvImport');
const { prisma } = require('../db');
const { AppError } = require('../utils/errors');

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

// POST /items/import — bulk import from CSV
const importItems = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError(400, 'VALIDATION_ERROR', 'No CSV file uploaded');
    }

    const { valid, errors } = parseAndValidate(req.file.buffer, createItemSchema);

    // Insert valid rows, skipping duplicates (Prisma skipDuplicates ignores unique constraint violations)
    let imported = 0;
    const skipped = [];

    if (valid.length > 0) {
      // Add tenantId to each row
      const rows = valid.map((row) => ({ ...row, tenantId: req.tenantId }));

      // Use createMany with skipDuplicates so duplicate partNumbers don't fail the whole batch
      const result = await prisma.item.createMany({
        data: rows,
        skipDuplicates: true,
      });
      imported = result.count;

      // If fewer were imported than valid, some were duplicates
      const dupCount = valid.length - imported;
      if (dupCount > 0) {
        skipped.push(`${dupCount} row(s) skipped due to duplicate part numbers`);
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

module.exports = { list, getById, create, update, deactivate, importItems };
