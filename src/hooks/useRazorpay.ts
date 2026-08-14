import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://jcxhagmfbezpgrxdxfvs.supabase.co';

interface CreateOrderParams {
  amount: number;
  currency?: string;
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone: string;
  orderId?: string;
  description?: string;
}

interface PaymentResult {
  success: boolean;
  transactionId?: string;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  error?: string;
}

export function useRazorpay() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scriptLoadedRef = useRef(false);

  // Load Razorpay script
  const loadScript = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      if (scriptLoadedRef.current || (window as any).Razorpay) {
        scriptLoadedRef.current = true;
        resolve(true);
        return;
      }

      const script = document.createElement('script');
      script.src = RAZORPAY_SCRIPT_URL;
      script.onload = () => {
        scriptLoadedRef.current = true;
        resolve(true);
      };
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }, []);

  // Call Razorpay edge function
  const callRazorpayApi = async (action: string, data: Record<string, unknown>) => {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/razorpay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, ...data }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText);
    }
    
    return response.json();
  };

  // Create order and initiate payment
  const initiatePayment = useCallback(async (
    params: CreateOrderParams,
    onSuccess?: (result: PaymentResult) => void,
    onFailure?: (error: string) => void
  ): Promise<PaymentResult> => {
    setIsLoading(true);
    setError(null);

    try {
      // Load Razorpay script
      const scriptLoaded = await loadScript();
      if (!scriptLoaded) {
        throw new Error('Failed to load Razorpay SDK');
      }

      // Create Razorpay order via edge function
      const orderResult = await callRazorpayApi('create-order', {
        amount: params.amount,
        currency: params.currency || 'INR',
        customerId: params.customerId,
        customerName: params.customerName,
        customerEmail: params.customerEmail,
        customerPhone: params.customerPhone,
        orderId: params.orderId,
        description: params.description,
      });

      if (orderResult.error) {
        throw new Error(orderResult.error);
      }

      // Open Razorpay checkout
      return new Promise((resolve) => {
        const options = {
          key: orderResult.keyId,
          amount: orderResult.amount,
          currency: orderResult.currency,
          name: 'Safepay',
          description: params.description || 'Secure SafePay Payment',
          order_id: orderResult.razorpayOrderId,
          prefill: {
            name: params.customerName || '',
            email: params.customerEmail || '',
            contact: params.customerPhone,
          },
          theme: {
            color: '#0ea5e9',
          },
          handler: async (response: any) => {
            try {
              // Verify payment
              const verifyResult = await callRazorpayApi('verify-payment', {
                transactionId: orderResult.transactionId,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id,
                razorpaySignature: response.razorpay_signature,
              });

              if (verifyResult.verified) {
                const result: PaymentResult = {
                  success: true,
                  transactionId: orderResult.transactionId,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpayOrderId: response.razorpay_order_id,
                };
                setIsLoading(false);
                onSuccess?.(result);
                resolve(result);
              } else {
                const errorMsg = verifyResult.error || 'Payment verification failed';
                setError(errorMsg);
                setIsLoading(false);
                onFailure?.(errorMsg);
                resolve({ success: false, error: errorMsg, transactionId: orderResult.transactionId });
              }
            } catch (err) {
              const errorMsg = String(err);
              setError(errorMsg);
              setIsLoading(false);
              onFailure?.(errorMsg);
              resolve({ success: false, error: errorMsg, transactionId: orderResult.transactionId });
            }
          },
          modal: {
            ondismiss: async () => {
              // User closed the payment modal
              await callRazorpayApi('update-failed', {
                transactionId: orderResult.transactionId,
                reason: 'User cancelled payment',
              });
              const errorMsg = 'Payment cancelled';
              setError(errorMsg);
              setIsLoading(false);
              onFailure?.(errorMsg);
              resolve({ success: false, error: errorMsg, transactionId: orderResult.transactionId });
            },
          },
        };

        const razorpay = new (window as any).Razorpay(options);
        razorpay.on('payment.failed', async (response: any) => {
          await callRazorpayApi('update-failed', {
            transactionId: orderResult.transactionId,
            reason: response.error?.description || 'Payment failed',
          });
          const errorMsg = response.error?.description || 'Payment failed';
          setError(errorMsg);
          setIsLoading(false);
          onFailure?.(errorMsg);
          resolve({ success: false, error: errorMsg, transactionId: orderResult.transactionId });
        });
        razorpay.open();
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      setIsLoading(false);
      onFailure?.(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, [loadScript]);

  return {
    initiatePayment,
    isLoading,
    error,
  };
}
