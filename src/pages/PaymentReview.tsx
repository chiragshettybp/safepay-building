import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useRazorpay } from '@/hooks/useRazorpay';
import { z } from 'zod';
import { PAYMENT_CONSTANTS, calculateServiceFee, calculateTotalWithFee } from '@/lib/constants';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const paymentSchema = z.object({
  merchantId: z.string().min(1),
  merchantName: z.string().min(1),
  merchantVerified: z.boolean().optional(),
  amount: z.number().min(100).max(50000),
  description: z.string().max(500).optional(),
  currency: z.enum(['INR', 'USD']),
});

type PaymentData = z.infer<typeof paymentSchema>;

export default function PaymentReview() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { initiatePayment, isLoading: razorpayLoading } = useRazorpay();
  
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ full_name?: string; email?: string; phone: string } | null>(null);
  
  const isSubmittingRef = useRef(false);
  
  // Use shared constants for fee calculation
  const serviceFee = paymentData ? calculateServiceFee(paymentData.amount) : 0;
  const totalAmount = paymentData ? calculateTotalWithFee(paymentData.amount) : 0;

  useEffect(() => {
    const stored = sessionStorage.getItem('pendingPayment');
    if (stored) {
      try {
        const result = paymentSchema.safeParse(JSON.parse(stored));
        if (result.success) {
          setPaymentData(result.data);
        } else {
          setValidationError('Invalid payment data.');
          setTimeout(() => navigate('/payment/new'), 2000);
        }
      } catch {
        setValidationError('Failed to load payment data.');
        setTimeout(() => navigate('/payment/new'), 2000);
      }
    } else {
      navigate('/payment/new');
    }
  }, [navigate]);

  // Fetch user profile (email column doesn't exist in profiles)
  useEffect(() => {
    if (!user?.id) return;
    supabase.from('profiles').select('full_name, phone').eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        setProfile({
          full_name: data?.full_name || user.fullName,
          phone: data?.phone || user.phone,
        });
      });
  }, [user?.id, user?.fullName, user?.phone]);

  const handleConfirmPayment = async () => {
    if (!paymentData || !user?.id || !agreedToTerms) return;
    if (isProcessing || isSubmittingRef.current) return;
    
    isSubmittingRef.current = true;
    setIsProcessing(true);
    
    try {
      // Create order first
      const orderNumber = `ORD${Date.now().toString(36).toUpperCase()}`;
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: user.id,
          order_number: orderNumber,
          merchant_id: paymentData.merchantId,
          merchant_name: paymentData.merchantName,
          product_name: paymentData.description?.trim() || `Payment to ${paymentData.merchantName}`,
          product_description: paymentData.description?.trim() || '',
          amount: totalAmount,
          currency: paymentData.currency,
          status: 'pending',
          escrow_status: 'held',
          notes: `Merchant ID: ${paymentData.merchantId}`,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Initiate Razorpay payment
      const result = await initiatePayment({
        amount: totalAmount,
        currency: paymentData.currency,
        customerId: user.id,
        customerName: profile?.full_name || user.fullName,
        customerEmail: user.email,
        customerPhone: profile?.phone || user.phone,
        orderId: order.id,
        description: paymentData.description || `Payment to ${paymentData.merchantName}`,
      });

      if (result.success) {
        // Update order escrow status
        await supabase.from('orders').update({ escrow_status: 'held' }).eq('id', order.id);
        
        sessionStorage.removeItem('pendingPayment');
        sessionStorage.setItem('paymentSuccess', JSON.stringify({
          orderId: order.id,
          orderNumber,
          merchantName: paymentData.merchantName,
          amount: totalAmount,
          currency: paymentData.currency,
        }));
        navigate('/payment/success');
      } else {
        // Update order as failed
        await supabase.from('orders').update({ status: 'cancelled', escrow_status: 'refunded' }).eq('id', order.id);
        
        sessionStorage.setItem('paymentStatus', JSON.stringify({
          status: 'failed',
          transactionId: result.transactionId || order.id,
          amount: totalAmount,
          currency: paymentData.currency,
          merchantName: paymentData.merchantName,
          error: result.error,
        }));
        navigate('/payment/status');
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast({ title: 'Payment Failed', description: 'Something went wrong.', variant: 'destructive' });
      isSubmittingRef.current = false;
    } finally {
      setIsProcessing(false);
    }
  };

  if (validationError) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <span className="material-symbols-outlined text-destructive text-[48px] mb-4">error</span>
        <p className="text-foreground font-medium text-center">{validationError}</p>
      </div>
    );
  }

  if (!paymentData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isButtonDisabled = !agreedToTerms || isProcessing || razorpayLoading;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-30 bg-card/95 backdrop-blur-sm border-b border-border h-14 flex items-center justify-between px-4">
        <button onClick={() => !isProcessing && navigate('/payment/new')} disabled={isProcessing} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-muted disabled:opacity-50">
          <span className="material-symbols-outlined text-[22px]">arrow_back</span>
        </button>
        <button className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-muted">
          <span className="material-symbols-outlined text-[22px]">help</span>
        </button>
      </header>

      <main className="flex-1 w-full max-w-md mx-auto px-4 pt-4 pb-28">
        <div className="flex flex-col items-center justify-center py-5 text-center">
          <div className="relative flex items-center justify-center w-14 h-14 rounded-full bg-success/10 text-success mb-4">
            <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
          </div>
          <h1 className="text-foreground text-2xl font-bold mb-2">Review & Pay</h1>
          <p className="text-muted-foreground text-sm">Complete payment via Razorpay</p>
        </div>

        <div className="bg-card rounded-2xl border border-border overflow-hidden mb-5">
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center">
                <span className="material-symbols-outlined text-muted-foreground text-[22px]">store</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{paymentData.merchantName}</p>
                <p className="text-xs text-muted-foreground">ID: #{paymentData.merchantId}</p>
              </div>
            </div>
          </div>
          <div className="p-4 flex flex-col gap-3">
            <div className="flex justify-between"><span className="text-muted-foreground text-sm">Subtotal</span><span className="text-foreground font-medium">₹{paymentData.amount.toLocaleString('en-IN')}</span></div>
            <div className="flex justify-between items-center">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-muted-foreground text-sm cursor-help flex items-center gap-1">
                      Service Fee <span className="text-xs">({PAYMENT_CONSTANTS.SERVICE_FEE_PERCENT}%)</span>
                      <span className="material-symbols-outlined text-[14px]">info</span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[200px] p-3">
                    <div className="text-xs space-y-1">
                      <p className="font-medium">Fee Breakdown</p>
                      <p>₹{paymentData.amount.toLocaleString('en-IN')} × {PAYMENT_CONSTANTS.SERVICE_FEE_PERCENT}% = ₹{serviceFee.toLocaleString('en-IN')}</p>
                      <p className="text-muted-foreground">This covers secure SafePay processing and buyer protection.</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <span className="text-foreground font-medium">₹{serviceFee.toLocaleString('en-IN')}</span>
            </div>
            <div className="h-px border-t border-dashed border-border"></div>
            <div className="flex flex-col items-center py-2">
              <span className="text-muted-foreground text-xs mb-1">Total Payment</span>
              <h2 className="text-4xl font-bold text-foreground"><span className="text-2xl text-muted-foreground">₹</span>{totalAmount.toLocaleString('en-IN')}</h2>
            </div>
          </div>
        </div>

        <label className="flex items-start gap-3 p-3 rounded-xl border border-border hover:bg-muted/30 cursor-pointer mb-4">
          <input type="checkbox" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} disabled={isProcessing} className="w-5 h-5 mt-0.5 rounded border-2 accent-primary" />
          <div><span className="text-foreground text-sm font-medium">I agree to Terms & Conditions</span><br/><span className="text-muted-foreground text-xs">By checking this, you agree to the SafePay policy.</span></div>
        </label>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border h-20 px-4 flex items-center justify-between z-40">
        <button onClick={() => !isProcessing && navigate('/payment/new')} disabled={isProcessing} className="text-muted-foreground text-sm font-medium px-3 disabled:opacity-50">Edit</button>
        <Button onClick={handleConfirmPayment} disabled={isButtonDisabled} className="flex-1 ml-3 h-12 rounded-xl text-base font-semibold">
          {isProcessing ? <span className="flex items-center gap-2"><span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>Processing...</span> : <>Pay with Razorpay<span className="material-symbols-outlined ml-2 text-[18px]">payment</span></>}
        </Button>
      </div>
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
    </div>
  );
}
