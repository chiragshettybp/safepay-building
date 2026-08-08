import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export interface User {
  id: string;
  phone: string;
  fullName?: string;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (phone: string, password: string) => Promise<{ error?: string }>;
  signup: (phone: string, password: string, fullName?: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  resetPassword: (phone: string, newPassword: string) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'safepay_auth_token';
const USER_KEY = 'safepay_user';

const SUPABASE_URL = 'https://sgpefhfmcykwtfqfwzcq.supabase.co';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const callAuthApi = async (action: string, data: Record<string, unknown>) => {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/auth/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return response.json();
  };

  const verifySession = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const result = await callAuthApi('verify-session', { token });
      if (result.user) {
        setUser(result.user);
        localStorage.setItem(USER_KEY, JSON.stringify(result.user));
      } else {
        // Session expired or invalid — clear silently
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
      }
    } catch {
      // Network error during verification — clear session silently
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Try to load user from localStorage first
    const storedUser = localStorage.getItem(USER_KEY);
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem(USER_KEY);
      }
    }
    
    // Then verify the session
    verifySession();
  }, [verifySession]);

  const login = async (phone: string, password: string): Promise<{ error?: string }> => {
    try {
      const result = await callAuthApi('login', { phone, password });
      
      if (result.error) {
        return { error: result.error };
      }

      if (result.user && result.token) {
        localStorage.setItem(TOKEN_KEY, result.token);
        localStorage.setItem(USER_KEY, JSON.stringify(result.user));
        setUser(result.user);
        return {};
      }

      return { error: 'Login failed' };
    } catch (error) {
      console.error('Login error:', error);
      return { error: 'Network error. Please try again.' };
    }
  };

  const signup = async (phone: string, password: string, fullName?: string): Promise<{ error?: string }> => {
    try {
      const result = await callAuthApi('signup', { phone, password, fullName });
      
      if (result.error) {
        return { error: result.error };
      }

      if (result.user && result.token) {
        localStorage.setItem(TOKEN_KEY, result.token);
        localStorage.setItem(USER_KEY, JSON.stringify(result.user));
        setUser(result.user);
        return {};
      }

      return { error: 'Signup failed' };
    } catch (error) {
      console.error('Signup error:', error);
      return { error: 'Network error. Please try again.' };
    }
  };

  const logout = async (): Promise<void> => {
    const token = localStorage.getItem(TOKEN_KEY);
    try {
      await callAuthApi('logout', { token });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      setUser(null);
    }
  };

  const resetPassword = async (phone: string, newPassword: string): Promise<{ error?: string }> => {
    try {
      const result = await callAuthApi('reset-password', { phone, newPassword });
      
      if (result.error) {
        return { error: result.error };
      }

      if (result.token) {
        localStorage.setItem(TOKEN_KEY, result.token);
        return {};
      }

      return { error: 'Password reset failed' };
    } catch (error) {
      console.error('Reset password error:', error);
      return { error: 'Network error. Please try again.' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
