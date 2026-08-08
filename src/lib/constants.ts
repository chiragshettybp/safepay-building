// Payment & Fee Constants
export const PAYMENT_CONSTANTS = {
  // Service fee percentage (2%)
  SERVICE_FEE_PERCENT: 2,
  
  // Payment limits
  MIN_PAYMENT_AMOUNT: 100,
  MAX_PAYMENT_AMOUNT: 50000,
  
  // Currency
  DEFAULT_CURRENCY: 'INR' as const,
  
  // Merchant payout processing fee (1%)
  MERCHANT_PAYOUT_FEE_PERCENT: 1,
  
  // Minimum withdrawal amount for merchants
  MIN_WITHDRAWAL_AMOUNT: 100,
} as const;

// Helper function to calculate service fee
export function calculateServiceFee(amount: number): number {
  return Math.round(amount * PAYMENT_CONSTANTS.SERVICE_FEE_PERCENT / 100);
}

// Helper function to calculate total with service fee
export function calculateTotalWithFee(amount: number): number {
  return amount + calculateServiceFee(amount);
}

// Helper function to calculate merchant payout fee
export function calculatePayoutFee(amount: number): number {
  return Math.round(amount * PAYMENT_CONSTANTS.MERCHANT_PAYOUT_FEE_PERCENT / 100);
}

// Helper function to calculate net payout amount
export function calculateNetPayout(amount: number): number {
  return amount - calculatePayoutFee(amount);
}
