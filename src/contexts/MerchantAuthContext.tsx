import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export interface MerchantUser {
  id: string;
  phone: string;
  fullName?: string;
  email?: string;
}

export interface Merchant {
  id: string;
  businessName: string;
  businessCategory?: string;
  verificationStatus: 'pending' | 'approved' | 'rejected';
  isActive: boolean;
}

interface MerchantAuthContextType {
  user: MerchantUser | null;
  merchant: Merchant | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (phone: string, password: string) => Promise<{ error?: string }>;
  signup: (data: MerchantSignupData) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

export interface MerchantSignupData {
  phone: string;
  password: string;
  fullName?: string;
  businessName: string;
  businessCategory?: string;
  gstNumber?: string;
  businessAddress?: string;
  businessCity?: string;
  businessState?: string;
  businessPincode?: string;
  businessEmail?: string;
}

const MerchantAuthContext = createContext<MerchantAuthContextType | undefined>(undefined);

const TOKEN_KEY = 'safepay_merchant_token';
const USER_KEY = 'safepay_merchant_user';
const MERCHANT_KEY = 'safepay_merchant_data';

const SUPABASE_URL = 'https://sgpefhfmcykwtfqfwzcq.supabase.co';

export function MerchantAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MerchantUser | null>(null);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const callMerchantAuthApi = async (action: string, data: Record<string, unknown>) => {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/merchant-auth/${action}`, {
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
      const result = await callMerchantAuthApi('verify-session', { token });
      if (result.user && result.merchant) {
        setUser(result.user);
        setMerchant(result.merchant);
        localStorage.setItem(USER_KEY, JSON.stringify(result.user));
        localStorage.setItem(MERCHANT_KEY, JSON.stringify(result.merchant));
      } else {
        // Session expired or invalid — clear silently
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(MERCHANT_KEY);
        setUser(null);
        setMerchant(null);
      }
    } catch {
      // Network error during verification — clear session silently
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(MERCHANT_KEY);
      setUser(null);
      setMerchant(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load from localStorage first
    const storedUser = localStorage.getItem(USER_KEY);
    const storedMerchant = localStorage.getItem(MERCHANT_KEY);
    
    if (storedUser && storedMerchant) {
      try {
        setUser(JSON.parse(storedUser));
        setMerchant(JSON.parse(storedMerchant));
      } catch (e) {
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(MERCHANT_KEY);
      }
    }
    
    verifySession();
  }, [verifySession]);

  const login = async (phone: string, password: string): Promise<{ error?: string }> => {
    try {
      const result = await callMerchantAuthApi('login', { phone, password });
      
      if (result.error) {
        return { error: result.error };
      }

      if (result.user && result.merchant && result.token) {
        localStorage.setItem(TOKEN_KEY, result.token);
        localStorage.setItem(USER_KEY, JSON.stringify(result.user));
        localStorage.setItem(MERCHANT_KEY, JSON.stringify(result.merchant));
        setUser(result.user);
        setMerchant(result.merchant);
        return {};
      }

      return { error: 'Login failed' };
    } catch (error) {
      console.error('Login error:', error);
      return { error: 'Network error. Please try again.' };
    }
  };

  const signup = async (data: MerchantSignupData): Promise<{ error?: string }> => {
    try {
      const result = await callMerchantAuthApi('signup', data as unknown as Record<string, unknown>);
      
      if (result.error) {
        return { error: result.error };
      }

      if (result.user && result.merchant && result.token) {
        localStorage.setItem(TOKEN_KEY, result.token);
        localStorage.setItem(USER_KEY, JSON.stringify(result.user));
        localStorage.setItem(MERCHANT_KEY, JSON.stringify(result.merchant));
        setUser(result.user);
        setMerchant(result.merchant);
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
      await callMerchantAuthApi('logout', { token });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(MERCHANT_KEY);
      setUser(null);
      setMerchant(null);
    }
  };

  const refreshStatus = async (): Promise<void> => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    try {
      const result = await callMerchantAuthApi('get-status', { token });
      if (result.verificationStatus && merchant) {
        const updatedMerchant = {
          ...merchant,
          verificationStatus: result.verificationStatus,
          isActive: result.isActive,
        };
        setMerchant(updatedMerchant);
        localStorage.setItem(MERCHANT_KEY, JSON.stringify(updatedMerchant));
      }
    } catch (error) {
      console.error('Status refresh error:', error);
    }
  };

  return (
    <MerchantAuthContext.Provider
      value={{
        user,
        merchant,
        isLoading,
        isAuthenticated: !!user && !!merchant,
        login,
        signup,
        logout,
        refreshStatus,
      }}
    >
      {children}
    </MerchantAuthContext.Provider>
  );
}

export function useMerchantAuth() {
  const context = useContext(MerchantAuthContext);
  if (context === undefined) {
    throw new Error('useMerchantAuth must be used within a MerchantAuthProvider');
  }
  return context;
}
