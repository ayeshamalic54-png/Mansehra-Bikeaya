import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiRequest, getStoredToken, setStoredToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [bootstrap, setBootstrap] = useState({
    zones: [],
    pricing_rules: [],
    settings: {},
    releases: [],
  });
  const [loading, setLoading] = useState(true);
  const [serverWaking, setServerWaking] = useState(false);
  const [dbError, setDbError] = useState(null);

  const refreshBootstrap = async ({ retryOnWake = false } = {}) => {
    const maxAttempts = retryOnWake ? 6 : 1;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const data = await apiRequest('/api/public/bootstrap', { auth: false });
        setBootstrap(data);
        setServerWaking(false);
        setDbError(null);
        return true;
      } catch (err) {
        if (err?.code === 'db_quota_exceeded' || err?.code === 'db_unavailable') {
          setServerWaking(false);
          setDbError({
            code: err.code,
            message: err.message,
          });
          return false;
        }
        if (attempt < maxAttempts) {
          setServerWaking(true);
          await new Promise((r) => setTimeout(r, 4000));
        } else {
          console.error('Bootstrap error:', err);
        }
      }
    }
    setServerWaking(false);
    return false;
  };

  const refreshMe = async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      return null;
    }
    try {
      const res = await apiRequest('/api/auth/me');
      setUser(res.user);
      return res.user;
    } catch {
      setStoredToken(null);
      setUser(null);
      return null;
    }
  };

  useEffect(() => {
    (async () => {
      await refreshBootstrap({ retryOnWake: true });
      await refreshMe();
      setLoading(false);
    })();
  }, []);

  const login = async (phone_or_email, password) => {
    const res = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { phone_or_email, password },
      auth: false,
    });
    setStoredToken(res.access_token);
    setUser(res.user);
    return res.user;
  };

  const register = async (payload) => {
    const res = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: payload,
      auth: false,
    });
    setStoredToken(res.access_token);
    setUser(res.user);
    return res.user;
  };

  const logout = () => {
    setStoredToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        bootstrap,
        loading,
        serverWaking,
        dbError,
        login,
        register,
        logout,
        refreshMe,
        refreshBootstrap,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
