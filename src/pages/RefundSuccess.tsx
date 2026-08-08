import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ArrowLeft, CheckCircle, Download, ExternalLink, CreditCard, Building, Smartphone, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Refund {
  id: string;
  public_refund_id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  reason: string;
  payment_method: string | null;
  payment_details: string | null;
  transaction_id: string | null;
  receipt_url: string | null;
  created_at: string;
  completed_at: string | null;
}

interface Order {
  id: string;
  public_order_id: string;
  order_number: string;
  merchant_name: string;
  product_name: string;
}

const getPaymentIcon = (method: string | null) => {
  if (method === 'upi') return Smartphone;
  if (method === 'bank') return Building;
  return CreditCard;
};

export default function RefundSuccess() {
  const { refundId } = useParams<{ refundId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [refund, setRefund] = useState<Refund | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!refundId || !user?.id) return;
      try {
        // Fetch refund
        const { data: refundData, error: refundError } = await supabase
          .from('refunds')
          .select('*')
          .eq('id', refundId)
          .eq('customer_id', user.id)
          .maybeSingle();

        if (refundError) throw refundError;
        if (!refundData) {
          navigate('/orders');
          return;
        }

        // Redirect if not success
        if (refundData.status !== 'success') {
          if (refundData.status === 'failed') {
            navigate(`/refunds/${refundId}/failed`);
          } else {
            navigate(`/refunds/${refundId}`);
          }
          return;
        }

        setRefund(refundData);

        // Fetch order
        const { data: orderData } = await supabase
          .from('orders')
          .select('id, public_order_id, order_number, merchant_name, product_name')
          .eq('id', refundData.order_id)
          .maybeSingle();
        
        if (orderData) setOrder(orderData);
      } catch (error) {
        console.error('Error fetching refund:', error);
        toast({ title: 'Error', description: 'Failed to load refund details', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [refundId, user?.id, navigate, toast]);

  const handleDownloadReceipt = async () => {
    if (!refund?.receipt_url) {
      toast({ title: 'No Receipt', description: 'Receipt not yet available', variant: 'destructive' });
      return;
    }
    
    setIsDownloading(true);
    try {
      window.open(refund.receipt_url, '_blank');
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to download receipt', variant: 'destructive' });
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!refund) return null;

  const PaymentIcon = getPaymentIcon(refund.payment_method);

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-foreground">Refund Complete</h1>
          <div className="w-9" />
        </div>
      </header>

      {/* Success Hero */}
      <div className="bg-gradient-to-br from-success/10 to-success/5 px-4 py-8 border-b border-border">
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center mb-4 animate-in zoom-in-50 duration-500">
            <CheckCircle className="w-10 h-10 text-success" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-1">Refund Successful!</h2>
          <p className="text-sm text-muted-foreground mb-4">Your refund has been processed and credited</p>
          <div className="bg-background rounded-2xl border border-border p-5 w-full">
            <p className="text-sm text-muted-foreground mb-1">Amount Refunded</p>
            <p className="text-4xl font-bold text-success">
              {refund.currency === 'USD' ? '$' : '₹'}{Number(refund.amount).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <main className="flex-1 p-4 space-y-4">
        {/* Transaction Details Card */}
        <div className="bg-background rounded-2xl border border-border p-4 space-y-4">
          <h3 className="font-bold text-foreground">Transaction Details</h3>
          
          <div className="space-y-3">
            {refund.transaction_id && (
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Refund ID</span>
                <span className="text-sm font-mono font-medium text-foreground">{refund.public_refund_id || refund.transaction_id}</span>
              </div>
            )}
            {refund.completed_at && (
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Credited On</span>
                <span className="text-sm font-medium text-foreground">
                  {format(new Date(refund.completed_at), 'MMM d, yyyy h:mm a')}
                </span>
              </div>
            )}
            {order && (
              <>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Order ID</span>
                  <span className="text-sm font-medium text-foreground">{order.public_order_id || `#${order.order_number}`}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Merchant</span>
                  <span className="text-sm font-medium text-foreground">{order.merchant_name}</span>
                </div>
              </>
            )}
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-muted-foreground">Reason</span>
              <span className="text-sm font-medium text-foreground capitalize">{refund.reason.replace(/_/g, ' ')}</span>
            </div>
          </div>
        </div>

        {/* Credited To Card */}
        <div className="bg-background rounded-2xl border border-border p-4">
          <h3 className="font-bold text-foreground mb-3">Credited To</h3>
          <div className="flex items-center gap-3 p-4 bg-success/5 rounded-xl border border-success/20">
            <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
              <PaymentIcon className="w-6 h-6 text-success" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground capitalize">
                {refund.payment_method || 'Original Payment Method'}
              </p>
              {refund.payment_details && (
                <p className="text-sm text-muted-foreground">{refund.payment_details}</p>
              )}
            </div>
            <CheckCircle className="w-5 h-5 text-success" />
          </div>
        </div>

        {/* Download Receipt */}
        <button
          onClick={handleDownloadReceipt}
          disabled={isDownloading || !refund.receipt_url}
          className="w-full bg-background rounded-2xl border border-border p-4 flex items-center justify-between hover:bg-muted/50 transition-colors disabled:opacity-50"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Download className="w-5 h-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">Download Receipt</p>
              <p className="text-xs text-muted-foreground">
                {refund.receipt_url ? 'PDF receipt available' : 'Receipt generating...'}
              </p>
            </div>
          </div>
          {isDownloading ? (
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          ) : (
            <ExternalLink className="w-5 h-5 text-muted-foreground" />
          )}
        </button>
      </main>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 pb-6 z-40">
        <div className="flex gap-3 max-w-lg mx-auto">
          {order && (
            <Link
              to={`/orders/${order.id}`}
              className="flex-1 h-12 border border-border rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-muted transition-colors"
            >
              View Order
            </Link>
          )}
          <Link
            to="/wallet"
            className="flex-1 h-12 bg-success text-success-foreground rounded-xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            Go to Wallet
          </Link>
        </div>
      </div>
    </div>
  );
}