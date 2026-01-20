import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await axios.get(`${API_BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(res.data.user);
    } catch (err) {
      console.error('Auth check failed:', err);
      localStorage.removeItem('token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = (token, userData) => {
    localStorage.setItem('token', token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('selectedFYearID');
    setUser(null);
  };

  const isAdmin = () => {
    return user?.role === 'ADMIN';
  };

  const isSalesperson = () => {
    return user?.role === 'SALES_STAFF';
  };

  const isAccountsManager = () => {
    return user?.role === 'ACCOUNTS_MANAGER';
  };

  const isAccountsStaff = () => {
    return user?.role === 'ACCOUNTS_STAFF';
  };

  const isStaff = () => {
    return ['SALES_STAFF', 'ACCOUNTS_MANAGER', 'ACCOUNTS_STAFF'].includes(user?.role);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      logout, 
      isAdmin, 
      isSalesperson,
      isAccountsManager,
      isAccountsStaff,
      isStaff,
      checkAuth 
    }}>
      {children}
    </AuthContext.Provider>
  );
};
