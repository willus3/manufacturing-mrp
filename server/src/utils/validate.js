const { AppError } = require('./errors');

// Higher-order function that returns Express middleware.
// Pass a Zod schema, and it validates req.body against it.
//
// Usage in routes:
//   router.post('/login', validate(loginSchema), controller.login)
//
const validate = (schema) => (req, res, next) => {
  try {
    // parse() throws a ZodError if validation fails,
    // and returns the cleaned/typed data if it passes
    req.body = schema.parse(req.body);
    next();
  } catch (err) {
    // Zod errors have an `issues` array with details about what failed
    const message = err.issues
      ? err.issues.map((i) => i.message).join(', ')
      : 'Validation failed';
    next(new AppError(400, 'VALIDATION_ERROR', message));
  }
};

module.exports = { validate };
