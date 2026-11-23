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

  const refreshBootstrap = async () => {
    try {
      const data = await apiRequest('/api/public/bootstrap', { auth: false });
      setBootstrap(data);
    } catch (err) {
      console.error('Bootstrap error:', err);
    }
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
      await Promise.all([refreshBootstrap(), refreshMe()]);
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
