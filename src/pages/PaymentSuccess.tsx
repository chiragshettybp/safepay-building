import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from '@/lib/toast';
import Confetti from '@/components/ui/confetti';
import { Check, Download, Eye, Lock } from 'lucide-react';
import { FullPageLoading } from '@/components/shared/LoadingSpinner';

interface SuccessData {
  orderId: string;
  orderNumber: string;
  publicOrderId?: string;
  merchantName: string;
  amount: number;
  currency: string;
}

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [successData, setSuccessData] = useState<SuccessData | null>(null);
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    const stored = sessionStorage.getItem('paymentSuccess');
    if (stored) {
      setSuccessData(JSON.parse(stored));
      sessionStorage.removeItem('paymentSuccess');
      
      // Hide confetti after animation
      setTimeout(() => setShowConfetti(false), 3000);
    } else {
      navigate('/dashboard');
    }
  }, [navigate]);

  const handleDownloadReceipt = () => {
    toast({
      title: 'Receipt Downloaded',
      description: 'Your payment receipt has been downloaded.',
    });
  };

  if (!successData) {
    return <FullPageLoading />;
  }

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
        {/* Success Animation */}
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center animate-bounce">
            <div className="w-16 h-16 rounded-full bg-success flex items-center justify-center">
              <Check className="text-white h-[36px] w-[36px]" />
            </div>
          </div>
          {/* Pulse ring */}
          <div className="absolute inset-0 w-20 h-20 rounded-full bg-success/20 animate-ping"></div>
        </div>

        {/* Success Message */}
        <h1 className="text-foreground text-2xl md:text-3xl font-bold text-center mb-2">Payment Locked!</h1>
        <p className="text-muted-foreground text-sm text-center max-w-[280px] mb-8">
          Your funds are now securely locked in SafePay until delivery is confirmed.
        </p>

        {/* Order Details Card */}
        <div className="w-full bg-card rounded-2xl border border-border p-5 mb-6">
          <div className="flex flex-col gap-4">
            {/* Order ID */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Order ID</span>
              <span className="text-foreground text-sm font-mono font-semibold">{successData.publicOrderId || `#${successData.orderNumber}`}</span>
            </div>
            
            {/* Merchant */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Merchant</span>
              <span className="text-foreground text-sm font-medium">{successData.merchantName}</span>
            </div>

            <div className="h-px bg-border"></div>

            {/* Amount */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Amount Locked</span>
              <span className="text-foreground text-lg font-bold">
                ₹{successData.amount.toLocaleString('en-IN')}
              </span>
            </div>

            {/* Status */}
            <div className="flex items-center justify-center gap-2 p-3 bg-success/5 rounded-xl border border-success/20">
              <Lock className="text-success h-[18px] w-[18px]" />
              <span className="text-success text-sm font-medium">Locked in SafePay</span>
            </div>
          </div>
        </div>

        {/* What's Next */}
        <div className="w-full bg-muted/30 rounded-xl p-4 mb-6">
          <h3 className="text-foreground text-sm font-semibold mb-3">What happens next?</h3>
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-primary text-xs font-bold">1</span>
              </div>
              <p className="text-muted-foreground text-xs">Merchant will be notified and prepare your order</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-primary text-xs font-bold">2</span>
              </div>
              <p className="text-muted-foreground text-xs">You'll receive updates on shipping status</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-primary text-xs font-bold">3</span>
              </div>
              <p className="text-muted-foreground text-xs">Confirm delivery to release funds to merchant</p>
            </div>
          </div>
        </div>

        {/* Download Receipt */}
        <button 
          onClick={handleDownloadReceipt}
          className="flex items-center gap-2 text-primary text-sm font-medium mb-4"
        >
          <Download className="h-[18px] w-[18px]" />
          Download Receipt
        </button>
      </main>

      {/* Sticky Bottom Action */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 pb-6 z-40">
        <div className="max-w-md mx-auto flex flex-col gap-2">
          <Link to={`/orders/${successData.orderId}`}>
            <Button variant="outline" className="w-full h-12 rounded-xl text-sm font-medium">
              <Eye className="mr-2 h-[18px] w-[18px]" />
              View Order Details
            </Button>
          </Link>
          <Link to="/dashboard">
            <Button className="w-full h-12 rounded-xl text-sm font-semibold">
              Go to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
