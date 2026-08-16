import React, { createContext, useContext } from 'react';

export interface MerchantProfileRow {
  id: string;
  user_id: string;
  business_name: string;
  business_category: string | null;
  business_email: string | null;
  business_phone: string | null;
  business_logo_url: string | null;
  verification_status: 'pending' | 'approved' | 'rejected';
  is_active: boolean;
  public_merchant_id: string;
}

const MerchantProfileContext = createContext<MerchantProfileRow | null>(null);

export function MerchantProfileProvider({ value, children }: { value: MerchantProfileRow | null; children: React.ReactNode }) {
  return <MerchantProfileContext.Provider value={value}>{children}</MerchantProfileContext.Provider>;
}

export function useMerchantProfile(): MerchantProfileRow | null {
  return useContext(MerchantProfileContext);
}
