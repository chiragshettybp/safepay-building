import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Confetti from '@/components/ui/confetti';
import {
  BadgeCheck,
  Check,
  CircleAlert,
  Clock,
  Eye,
  Hourglass,
  ReceiptText,
  RefreshCw,
  X,
} from 'lucide-react';
import { FullPageLoading } from '@/components/shared/LoadingSpinner';
import { formatAmount } from '@/lib/format';

interface PaymentStatusData {
  status: 'success' | 'failed' | 'pending';
  transactionId: string;
  publicTransactionId?: string;
  razorpayPaymentId?: string;
  amount: number;
  currency: string;
  merchantName?: string;
  orderId?: string;
  orderNumber?: string;
  publicOrderId?: string;
  error?: string;
}

export default function PaymentStatus() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [statusData, setStatusData] = useState<PaymentStatusData | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem('paymentStatus');
    if (stored) {
      const data = JSON.parse(stored) as PaymentStatusData;
      setStatusData(data);
      
      if (data.status === 'success') {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
      }
      
      // Clear after reading
      sessionStorage.removeItem('paymentStatus');
    } else {
      // Check URL params as fallback
      const status = searchParams.get('status');
      const transactionId = searchParams.get('transactionId');
      
      if (status && transactionId) {
        setStatusData({
          status: status as 'success' | 'failed' | 'pending',
          transactionId,
          amount: parseFloat(searchParams.get('amount') || '0'),
          currency: searchParams.get('currency') || 'INR',
          razorpayPaymentId: searchParams.get('paymentId') || undefined,
        });
      } else {
        navigate('/dashboard');
      }
    }
  }, [navigate, searchParams]);

  if (!statusData) {
    return <FullPageLoading />;
  }

  const isSuccess = statusData.status === 'success';
  const isFailed = statusData.status === 'failed';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {showConfetti && <Confetti />}

      {/* Header */}
      <header className="sticky top-0 z-30 bg-card/95 backdrop-blur-sm border-b border-border h-14 flex items-center justify-center px-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs">S</div>
          <span className="font-bold text-base text-foreground">Safepay</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 pt-8 pb-32 flex flex-col items-center">
        {/* Status Animation */}
        <div className="relative mb-6">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
            isSuccess ? 'bg-success/10' : isFailed ? 'bg-destructive/10' : 'bg-warning/10'
          } ${isSuccess ? 'animate-bounce' : ''}`}>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
              isSuccess ? 'bg-success' : isFailed ? 'bg-destructive' : 'bg-warning'
            }`}>
              {isSuccess ? (
                <Check className="text-white h-[36px] w-[36px]" />
              ) : isFailed ? (
                <X className="text-white h-[36px] w-[36px]" />
              ) : (
                <Hourglass className="text-white h-[36px] w-[36px]" />
              )}
            </div>
          </div>
          {isSuccess && (
            <div className="absolute inset-0 w-20 h-20 rounded-full bg-success/20 animate-ping"></div>
          )}
        </div>

        {/* Status Message */}
        <h1 className="text-foreground text-2xl md:text-3xl font-bold text-center mb-2">
          {isSuccess ? 'Payment Successful!' : isFailed ? 'Payment Failed' : 'Payment Pending'}
        </h1>
        <p className="text-muted-foreground text-sm text-center max-w-[280px] mb-8">
          {isSuccess 
            ? 'Your payment has been processed successfully.'
            : isFailed 
              ? statusData.error || 'Your payment could not be processed. Please try again.'
              : 'Your payment is being processed. Please wait.'}
        </p>

        {/* Payment Details Card */}
        <div className="w-full bg-card rounded-2xl border border-border p-5 mb-6">
          <div className="flex flex-col gap-4">
            {/* Amount */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Amount</span>
              <span className="text-foreground text-lg font-bold">
                {formatAmount(statusData.amount, statusData.currency)}
              </span>
            </div>

            {/* Transaction ID */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Transaction ID</span>
              <span className="text-foreground text-sm font-mono">{statusData.publicTransactionId || `${statusData.transactionId.slice(0, 8)}...`}</span>
            </div>

            {/* Razorpay Payment ID */}
            {statusData.razorpayPaymentId && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Payment ID</span>
                <span className="text-foreground text-sm font-mono">{statusData.razorpayPaymentId}</span>
              </div>
            )}

            {/* Merchant */}
            {statusData.merchantName && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Merchant</span>
                <span className="text-foreground text-sm font-medium">{statusData.merchantName}</span>
              </div>
            )}

            <div className="h-px bg-border"></div>

            {/* Status */}
            <div className={`flex items-center justify-center gap-2 p-3 rounded-xl border ${
              isSuccess 
                ? 'bg-success/5 border-success/20' 
                : isFailed 
                  ? 'bg-destructive/5 border-destructive/20'
                  : 'bg-warning/5 border-warning/20'
            }`}>
              {(() => {
                const StatusIcon = isSuccess ? BadgeCheck : isFailed ? CircleAlert : Clock;
                return <StatusIcon className={`h-[18px] w-[18px] ${
                  isSuccess ? 'text-success' : isFailed ? 'text-destructive' : 'text-warning'
                }`} />;
              })()}
              <span className={`text-sm font-medium ${
                isSuccess ? 'text-success' : isFailed ? 'text-destructive' : 'text-warning'
              }`}>
                {isSuccess ? 'Payment Complete' : isFailed ? 'Payment Failed' : 'Processing'}
              </span>
            </div>
          </div>
        </div>

        {/* Order Link if exists */}
        {statusData.orderId && isSuccess && (
          <Link 
            to={`/orders/${statusData.orderId}`}
            className="flex items-center gap-2 text-primary text-sm font-medium mb-4"
          >
            <Eye className="h-[18px] w-[18px]" />
            View Order {statusData.publicOrderId || `#${statusData.orderNumber}`}
          </Link>
        )}
      </main>

      {/* Sticky Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 pb-6 z-40">
        <div className="max-w-md mx-auto flex flex-col gap-2">
          {isFailed && (
            <Link to="/payment/new">
              <Button className="w-full h-12 rounded-xl text-sm font-semibold">
                <RefreshCw className="mr-2 h-[18px] w-[18px]" />
                Retry Payment
              </Button>
            </Link>
          )}
          <Link to={`/transactions/${statusData.transactionId}`}>
            <Button variant={isFailed ? "outline" : "default"} className="w-full h-12 rounded-xl text-sm font-medium">
              <ReceiptText className="mr-2 h-[18px] w-[18px]" />
              View Transaction Details
            </Button>
          </Link>
          <Link to="/transactions">
            <Button variant="outline" className="w-full h-12 rounded-xl text-sm font-medium">
              All Transactions
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
