import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiCall } from '../../utils/supabase';

interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: 'user' | 'admin';
  kycStatus?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: { email: string; password: string; name: string; phone: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkSession = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const data = await apiCall('/auth/session');
      setUser(data.user);
    } catch (error) {
      console.error('Session check failed:', error);
      localStorage.removeItem('accessToken');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const login = async (email: string, password: string) => {
    const data = await apiCall('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    localStorage.setItem('accessToken', data.accessToken);
    setUser(data.user);
  };

  const signup = async (signupData: { email: string; password: string; name: string; phone: string }) => {
    await apiCall('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(signupData),
    });
  };

  const logout = async () => {
    try {
      await apiCall('/auth/signout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('accessToken');
      setUser(null);
    }
  };

  const refreshUser = async () => {
    await checkSession();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
