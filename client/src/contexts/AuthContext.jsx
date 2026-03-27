// Auth context — holds the current user session and provides auth actions.
//
// Provides:
//   - user: current user object (or null if not logged in)
//   - isAuthenticated: boolean
//   - isLoading: true while checking session on mount
//   - login(email, password, tenantSlug): authenticate and store tokens
//   - logout(): clear tokens and redirect to login
//   - hasPermission(code): check if user has a specific permission
//
// On mount, checks for stored tokens and loads the user via GET /auth/me.
// If no valid tokens exist, the user stays unauthenticated (no redirect).

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { api, setTokens, clearTokens, getAccessToken } from '@/lib/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, check if we have a stored token and load the user
  useEffect(() => {
    const loadUser = async () => {
      const token = getAccessToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const { data } = await api.get('/auth/me');
        setUser(data);
      } catch {
        // Token is invalid or expired and refresh failed — clear everything
        clearTokens();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  const login = useCallback(async (email, password, tenantSlug) => {
    const { data } = await api.post('/auth/login', { email, password, tenantSlug });
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Logout API might fail if token is already expired — that's fine
    } finally {
      clearTokens();
      setUser(null);
    }
  }, []);

  // Check if the current user has a specific permission.
  // Super admins implicitly have all permissions.
  const hasPermission = useCallback(
    (permissionCode) => {
      if (!user) return false;
      if (user.isSuperAdmin) return true;
      return user.permissions?.includes(permissionCode) ?? false;
    },
    [user]
  );

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
      hasPermission,
    }),
    [user, isLoading, login, logout, hasPermission]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
