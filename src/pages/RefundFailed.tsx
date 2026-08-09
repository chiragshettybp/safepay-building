import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ArrowLeft, XCircle, RefreshCw, MessageCircle, Edit, ExternalLink, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from '@/lib/toast';
import { formatAmount } from '@/lib/format';

interface Refund {
  id: string;
  public_refund_id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  reason: string;
  failure_reason: string | null;
  retry_allowed: boolean;
  payment_method: string | null;
  payment_details: string | null;
  created_at: string;
  updated_at: string;
}

interface Order {
  id: string;
  public_order_id: string;
  order_number: string;
  merchant_name: string;
  product_name: string;
}

interface RefundEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  status: string | null;
  created_at: string;
}

export default function RefundFailed() {
  const { refundId } = useParams<{ refundId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [refund, setRefund] = useState<Refund | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [events, setEvents] = useState<RefundEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);

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

        // Redirect if not failed
        if (refundData.status !== 'failed') {
          if (refundData.status === 'success') {
            navigate(`/refunds/${refundId}/success`);
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

        // Fetch events
        const { data: eventsData } = await supabase
          .from('refund_events')
          .select('*')
          .eq('refund_id', refundId)
          .order('created_at', { ascending: false });

        if (eventsData) setEvents(eventsData);
      } catch (error) {
        console.error('Error fetching refund:', error);
        toast({ title: 'Error', description: 'Failed to load refund details', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [refundId, user?.id, navigate]);

  const handleRetry = async () => {
    if (!refund || !refund.retry_allowed) return;
    
    setIsRetrying(true);
    try {
      // Update refund status to processing
      const { error: updateError } = await supabase
        .from('refunds')
        .update({ 
          status: 'processing',
          failure_reason: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', refund.id);

      if (updateError) throw updateError;

      // Add retry event
      await supabase.from('refund_events').insert({
        refund_id: refund.id,
        title: 'Retry Initiated',
        description: 'Customer requested refund retry',
        event_type: 'retry',
        status: 'processing'
      });

      // Add notification
      if (user?.id) {
        await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'info',
          title: 'Refund Retry Started',
          message: `Refund of ${formatAmount(refund.amount, refund.currency)} is being retried`,
          link: `/refunds/${refund.id}`
        });
      }

      toast({ title: 'Retry Started', description: 'Your refund is being processed again' });
      navigate(`/refunds/${refund.id}`);
    } catch (error) {
      console.error('Retry error:', error);
      toast({ title: 'Error', description: 'Failed to retry refund', variant: 'destructive' });
    } finally {
      setIsRetrying(false);
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

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col pb-32">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-foreground">Refund Failed</h1>
          <div className="w-9" />
        </div>
      </header>

      {/* Error Hero */}
      <div className="bg-gradient-to-br from-destructive/10 to-destructive/5 px-4 py-8 border-b border-border">
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center mb-4">
            <XCircle className="w-10 h-10 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-1">Refund Could Not Be Completed</h2>
          <p className="text-sm text-muted-foreground mb-4">There was an issue processing your refund</p>
          <div className="bg-background rounded-2xl border border-border p-5 w-full">
            <p className="text-sm text-muted-foreground mb-1">Refund Amount</p>
            <p className="text-4xl font-bold text-destructive">
              {formatAmount(refund.amount, refund.currency)}
            </p>
          </div>
        </div>
      </div>

      <main className="flex-1 p-4 space-y-4">
        {/* Error Reason Card */}
        <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-foreground mb-1">Error Details</h3>
              <p className="text-sm text-muted-foreground">
                {refund.failure_reason || 'Payment processing failed. This could be due to bank connectivity issues or invalid payment details.'}
              </p>
            </div>
          </div>
        </div>

        {/* Refund Details Card */}
        <div className="bg-background rounded-2xl border border-border p-4 space-y-4">
          <h3 className="font-bold text-foreground">Refund Details</h3>
          
          <div className="space-y-3">
            {order && (
              <>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Refund ID</span>
                  <span className="text-sm font-medium text-foreground font-mono">{refund.public_refund_id}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Order ID</span>
                  <span className="text-sm font-medium text-foreground">{order?.public_order_id || `#${order?.order_number}`}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Merchant</span>
                  <span className="text-sm font-medium text-foreground">{order.merchant_name}</span>
                </div>
              </>
            )}
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">Reason</span>
              <span className="text-sm font-medium text-foreground capitalize">{refund.reason.replace(/_/g, ' ')}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-muted-foreground">Retry Available</span>
              <span className={`text-sm font-medium ${refund.retry_allowed ? 'text-success' : 'text-destructive'}`}>
                {refund.retry_allowed ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        </div>

        {/* Attempt History */}
        {events.length > 0 && (
          <div className="bg-background rounded-2xl border border-border p-4">
            <h3 className="font-bold text-foreground mb-4">Attempt History</h3>
            <div className="space-y-3">
              {events.map((event) => (
                <div key={event.id} className="flex items-start gap-3 p-3 bg-muted/50 rounded-xl">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    event.status === 'failed' ? 'bg-destructive/10 text-destructive' :
                    event.status === 'completed' ? 'bg-success/10 text-success' :
                    'bg-warning/10 text-warning'
                  }`}>
                    {event.status === 'failed' ? (
                      <XCircle className="w-4 h-4" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{event.title}</p>
                    {event.description && (
                      <p className="text-xs text-muted-foreground">{event.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(event.created_at), 'MMM d, h:mm a')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Cards */}
        <div className="space-y-3">
          <Link
            to="/profile/edit"
            className="w-full bg-background rounded-2xl border border-border p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Edit className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Update Payment Details</p>
              <p className="text-xs text-muted-foreground">Check if your bank/UPI details are correct</p>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground" />
          </Link>

          <Link
            to="/help"
            className="w-full bg-background rounded-2xl border border-border p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-warning" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Contact Support</p>
              <p className="text-xs text-muted-foreground">Get help from our support team</p>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground" />
          </Link>
        </div>
      </main>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 pb-6 z-40">
        <div className="flex gap-3 max-w-lg mx-auto">
          <Link
            to="/dashboard"
            className="flex-1 h-12 border border-border rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-muted transition-colors"
          >
            Dashboard
          </Link>
          {refund.retry_allowed && (
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="flex-1 h-12 bg-primary text-primary-foreground rounded-xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              {isRetrying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Retry Refund
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}