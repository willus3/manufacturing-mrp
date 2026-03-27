// Standardized response helpers.
// Every endpoint uses these so the frontend always gets the same shape:
//   { data, meta, error }

const sendSuccess = (res, data, meta = null, statusCode = 200) => {
  res.status(statusCode).json({ data, meta, error: null });
};

const sendError = (res, error) => {
  const statusCode = error.statusCode || 500;
  const code = error.code || 'INTERNAL_ERROR';
  const message = error.message || 'An unexpected error occurred';

  res.status(statusCode).json({
    data: null,
    meta: null,
    error: { code, message },
  });
};

module.exports = { sendSuccess, sendError };
