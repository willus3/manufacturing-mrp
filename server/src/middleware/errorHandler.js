const { AppError } = require('../utils/errors');
const { sendError } = require('../utils/response');

// Global error handler — must have 4 parameters so Express recognizes it.
// Every error thrown or passed to next(error) ends up here.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Log the error for debugging (timestamp + request context)
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}:`, err.message);

  // If it's already our custom AppError, use it directly
  if (err instanceof AppError) {
    return sendError(res, err);
  }

  // Prisma unique constraint violation (e.g., duplicate email)
  if (err.code === 'P2002') {
    return sendError(res, new AppError(409, 'DUPLICATE_ENTRY', 'A record with that value already exists'));
  }

  // Prisma record not found
  if (err.code === 'P2025') {
    return sendError(res, new AppError(404, 'NOT_FOUND', 'Record not found'));
  }

  // Anything else is an unexpected error — don't leak internal details
  sendError(res, new AppError(500, 'INTERNAL_ERROR', 'An unexpected error occurred'));
};

module.exports = { errorHandler };
