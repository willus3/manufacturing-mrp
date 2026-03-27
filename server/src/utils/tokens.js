const jwt = require('jsonwebtoken');
const { unauthorizedError } = require('./errors');

// Access tokens carry the full user context (userId, tenantId, permissions).
// They're short-lived (1 hour) and used on every API request.
const signAccessToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRY || '1h',
  });
};

const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    throw unauthorizedError('Invalid or expired access token');
  }
};

// Refresh tokens only carry the userId — minimal data since they're longer-lived (7 days).
// Used only to get a new access token when the old one expires.
const signRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d',
  });
};

const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch (err) {
    throw unauthorizedError('Invalid or expired refresh token');
  }
};

module.exports = {
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken,
};
