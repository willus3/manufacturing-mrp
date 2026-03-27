const inventoryService = require('./inventory.service');
const { sendSuccess } = require('../utils/response');
const {
  listStockQuery,
  stockSummaryQuery,
  listTransactionsQuery,
} = require('./inventory.validation');

/** GET /inventory/stock — paginated stock list. */
const listStock = async (req, res, next) => {
  try {
    const query = listStockQuery.parse(req.query);
    const { stock, meta } = await inventoryService.listStock(req.tenantId, query);
    sendSuccess(res, stock, meta);
  } catch (err) {
    next(err);
  }
};

/** GET /inventory/stock/summary — aggregated per item. */
const stockSummary = async (req, res, next) => {
  try {
    const query = stockSummaryQuery.parse(req.query);
    const summary = await inventoryService.stockSummary(req.tenantId, query);
    sendSuccess(res, summary);
  } catch (err) {
    next(err);
  }
};

/** GET /inventory/transactions — paginated transaction log. */
const listTransactions = async (req, res, next) => {
  try {
    const query = listTransactionsQuery.parse(req.query);
    const { transactions, meta } = await inventoryService.listTransactions(req.tenantId, query);
    sendSuccess(res, transactions, meta);
  } catch (err) {
    next(err);
  }
};

/** POST /inventory/adjust — create adjustment. */
const adjust = async (req, res, next) => {
  try {
    const result = await inventoryService.adjust(req.body, req.tenantId, req.user.userId);
    sendSuccess(res, result, null, 201);
  } catch (err) {
    next(err);
  }
};

/** POST /inventory/transfer — move stock between locations. */
const transfer = async (req, res, next) => {
  try {
    const result = await inventoryService.transfer(req.body, req.tenantId, req.user.userId);
    sendSuccess(res, result, null, 201);
  } catch (err) {
    next(err);
  }
};

module.exports = { listStock, stockSummary, listTransactions, adjust, transfer };
