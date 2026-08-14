import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { AlertCircle, ArrowLeft, Check, CheckCircle2, Loader2, Mail, Phone, Store } from 'lucide-react';
import { FullPageLoading } from '@/components/shared/LoadingSpinner';
import Confetti from '@/components/ui/confetti';
import { PaymentSuccessAnimation } from '@/components/ui/payment-success-animation';
import { PAYMENT_METHOD_BRANDS, PaymentBrand } from '@/components/ui/payment-brands';
import { cn } from '@/lib/utils';
import { formatAmount } from '@/lib/format';
import { callCheckout, checkoutMethodLabel, getCheckoutSessionToken, type PublicCheckoutData } from '@/lib/checkout';

export default function PublicCheckoutSuccess() {
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PublicCheckoutData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [receiptVisible, setReceiptVisible] = useState(false);

  const handleAnimationComplete = useCallback(() => {
    setReceiptVisible(true);
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3000);
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      // The success page confirms THIS customer's order via their session
      // token (stored at checkout open). Without one, send them to the
      // checkout page, which will open a fresh session for the link.
      const sessionToken = getCheckoutSessionToken(token);
      if (!sessionToken) {
        navigate(`/checkout/${token}`, { replace: true });
        return;
      }
      const result = await callCheckout<PublicCheckoutData>('get-status', { token: sessionToken });
      if (result.not_found) {
        setError('This payment link is invalid.');
      } else if (!result.order) {
        navigate(`/checkout/${token}`, { replace: true });
      } else {
        setData(result);
      }
    } catch {
      setError('Could not load the payment confirmation.');
    } finally {
      setIsLoading(false);
    }
  }, [token, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  if (isLoading) {
    return <FullPageLoading />;
  }

  if (error || !data || !data.order) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-6">
        <AlertCircle className="text-destructive h-12 w-12 mb-4" />
        <h1 className="text-lg font-semibold text-foreground text-center mb-2">Confirmation unavailable</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">{error || 'No payment found for this link.'}</p>
        <Button variant="outline" onClick={() => navigate('/')}>Go to SafePay</Button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b border-border h-14 flex items-center gap-2 px-4 safe-top">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Store className="w-4 h-4 text-primary" />
        </div>
        <p className="text-sm font-semibold text-foreground truncate">{data.merchant.business_name}</p>
      </header>

      <main className="flex-1 overflow-y-auto">
        {data && !receiptVisible && (
          <PaymentSuccessAnimation onComplete={handleAnimationComplete} />
        )}
        <div
          className={cn(
            'w-full max-w-md mx-auto px-4 pt-8 pb-10 text-center',
            receiptVisible && 'animate-in fade-in duration-300'
          )}
        >
          {showConfetti && <Confetti />}
          <div className="relative inline-flex mb-5">
            <div className="absolute inset-0 bg-success/20 rounded-full blur-xl" />
            <div className="relative w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 text-success" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-1">Payment successful</h1>
          <p className="text-sm text-muted-foreground mb-6">
            We have received your payment and it is held in escrow until {data.merchant.business_name} ships your order.
          </p>

          <div className="bg-card rounded-2xl border border-border p-5 mb-4 text-left">
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-border">
              <span className="text-sm text-muted-foreground">Order</span>
              <span className="text-sm font-semibold text-foreground font-mono">{data.order.public_order_id}</span>
            </div>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Merchant</span>
                <span className="font-medium text-foreground text-right">{data.merchant.business_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount paid</span>
                <span className="font-semibold text-foreground">{formatAmount(data.order.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment method</span>
                <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                  {data.session.selected_payment_method
                    ? checkoutMethodLabel(data.session.selected_payment_method)
                    : 'Online'}
                  {data.session.selected_payment_method &&
                    PAYMENT_METHOD_BRANDS[data.session.selected_payment_method]?.slice(0, 1).map((bid) => (
                      <PaymentBrand key={bid} id={bid} />
                    ))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="inline-flex items-center gap-1 font-medium text-success">
                  <Check className="w-3.5 h-3.5" />
                  Paid & escrowed
                </span>
              </div>
            </div>
          </div>

          {data.items.length > 0 && (
            <div className="bg-card rounded-2xl border border-border p-5 mb-4 text-left">
              <h2 className="text-sm font-semibold text-foreground mb-3">Items</h2>
              <div className="space-y-2">
                {data.items.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.item_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.variant_label && `${item.variant_label} · `}
                        {formatAmount(item.unit_price)} × {item.quantity}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-foreground shrink-0">{formatAmount(item.line_total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-muted/30 rounded-2xl p-4 mb-6 text-left">
            <h2 className="text-sm font-semibold text-foreground mb-2">What happens next?</h2>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li>• {data.merchant.business_name} prepares and ships your order.</li>
              <li>• Money stays protected in escrow until you confirm delivery.</li>
              <li>• Track your order anytime on SafePay.</li>
            </ul>
          </div>

          <Button
            className="w-full h-12"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-4 w-4 mr-2 rotate-180" />
            Continue on SafePay
          </Button>
        </div>
      </main>
    </div>
  );
}
