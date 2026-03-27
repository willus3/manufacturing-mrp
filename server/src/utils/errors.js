// Custom error class that carries an HTTP status code and error code.
// Thrown anywhere in the app — the global error handler catches it
// and sends the right response format.
class AppError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

// Factory functions for common errors — keeps calling code clean
const unauthorizedError = (message = 'Authentication required') =>
  new AppError(401, 'UNAUTHORIZED', message);

const forbiddenError = (message = 'Insufficient permissions') =>
  new AppError(403, 'FORBIDDEN', message);

const validationError = (message = 'Validation failed') =>
  new AppError(400, 'VALIDATION_ERROR', message);

const notFoundError = (message = 'Resource not found') =>
  new AppError(404, 'NOT_FOUND', message);

const conflictError = (message = 'Resource already exists') =>
  new AppError(409, 'DUPLICATE_ENTRY', message);

module.exports = {
  AppError,
  unauthorizedError,
  forbiddenError,
  validationError,
  notFoundError,
  conflictError,
};
