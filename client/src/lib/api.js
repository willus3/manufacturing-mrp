// Centralized API client with JWT token management.
//
// Handles:
//   - Storing access + refresh tokens in localStorage
//   - Attaching Authorization header to every request
//   - Auto-refreshing expired access tokens (401 → refresh → retry)
//   - Redirecting to login if refresh fails

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

// ============================================
// Token storage
// ============================================
const TOKEN_KEY = 'mrp_access_token';
const REFRESH_KEY = 'mrp_refresh_token';

export const getAccessToken = () => localStorage.getItem(TOKEN_KEY);
export const getRefreshToken = () => localStorage.getItem(REFRESH_KEY);

export const setTokens = (accessToken, refreshToken) => {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
};

export const clearTokens = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
};

// ============================================
// Base fetch wrapper
// ============================================
// Sends JSON requests with auth header. Does NOT handle refresh —
// that's done by the higher-level `api` function below.
const baseFetch = async (endpoint, options = {}) => {
  const { body, headers: customHeaders, ...rest } = options;

  const headers = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };

  const token = getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    headers,
    body: body ? JSON.stringify(body) : undefined,
    ...rest,
  });

  return response;
};

// ============================================
// Token refresh logic
// ============================================
// Prevents multiple simultaneous refresh requests — if one is already
// in flight, other callers wait for the same promise.
let refreshPromise = null;

const refreshAccessToken = async () => {
  // If a refresh is already in progress, wait for it
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token');
    }

    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      clearTokens();
      throw new Error('Refresh failed');
    }

    const { data } = await response.json();
    setTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
};

// ============================================
// Main API function
// ============================================
// Wraps baseFetch with auto-refresh: if a request returns 401,
// attempts to refresh the token and retry once.
export const api = async (endpoint, options = {}) => {
  let response = await baseFetch(endpoint, options);

  // If 401 and we have a refresh token, try to refresh and retry
  if (response.status === 401 && getRefreshToken()) {
    try {
      await refreshAccessToken();
      response = await baseFetch(endpoint, options);
    } catch {
      // Refresh failed — redirect to login
      clearTokens();
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }

  // Parse response
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error?.message || 'Request failed');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
};

// ============================================
// Convenience methods
// ============================================
api.get = (endpoint, options) => api(endpoint, { method: 'GET', ...options });
api.post = (endpoint, body, options) => api(endpoint, { method: 'POST', body, ...options });
api.put = (endpoint, body, options) => api(endpoint, { method: 'PUT', body, ...options });
api.patch = (endpoint, body, options) => api(endpoint, { method: 'PATCH', body, ...options });
api.delete = (endpoint, options) => api(endpoint, { method: 'DELETE', ...options });
