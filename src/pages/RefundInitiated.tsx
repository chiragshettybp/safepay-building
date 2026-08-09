import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ArrowLeft, Clock, CheckCircle, Loader2, AlertCircle, CreditCard, Building, Smartphone, ExternalLink } from 'lucide-react';
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

const getPaymentIcon = (method: string | null) => {
  if (method === 'upi') return Smartphone;
  if (method === 'bank') return Building;
  return CreditCard;
};

export default function RefundInitiated() {
  const { refundId } = useParams<{ refundId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [refund, setRefund] = useState<Refund | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [events, setEvents] = useState<RefundEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
        setRefund(refundData);

        // Redirect based on status
        if (refundData.status === 'success') {
          navigate(`/refunds/${refundId}/success`);
          return;
        } else if (refundData.status === 'failed') {
          navigate(`/refunds/${refundId}/failed`);
          return;
        }

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
          .order('created_at', { ascending: true });

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

  // Realtime subscription
  useEffect(() => {
    if (!refundId) return;

    const channel = supabase
      .channel('refund-updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'refunds',
        filter: `id=eq.${refundId}`
      }, (payload) => {
        const updated = payload.new as Refund;
        setRefund(updated);
        
        if (updated.status === 'success') {
          toast({ title: 'Refund Completed!', description: 'Your refund has been processed.' });
          navigate(`/refunds/${refundId}/success`);
        } else if (updated.status === 'failed') {
          toast({ title: 'Refund Failed', description: 'There was an issue with your refund.', variant: 'destructive' });
          navigate(`/refunds/${refundId}/failed`);
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'refund_events',
        filter: `refund_id=eq.${refundId}`
      }, (payload) => {
        setEvents(prev => [...prev, payload.new as RefundEvent]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refundId, navigate]);

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
          <h1 className="font-bold text-foreground">Refund Status</h1>
          <div className="w-9" />
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-br from-warning/10 to-warning/5 px-4 py-6 border-b border-border">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-14 h-14 rounded-full bg-warning/20 flex items-center justify-center">
            <Clock className="w-7 h-7 text-warning" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Refund In Progress</h2>
            <p className="text-sm text-muted-foreground">Your refund is being processed</p>
          </div>
        </div>
        <div className="bg-background rounded-2xl border border-border p-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">Refund Amount</p>
            <p className="text-3xl font-bold text-warning">
              {formatAmount(refund.amount, refund.currency)}
            </p>
          </div>
        </div>
      </div>

      <main className="flex-1 p-4 space-y-4">
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
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">Initiated On</span>
              <span className="text-sm font-medium text-foreground">
                {format(new Date(refund.created_at), 'MMM d, yyyy h:mm a')}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-muted-foreground">Expected Time</span>
              <span className="text-sm font-medium text-success">3-5 business days</span>
            </div>
          </div>
        </div>

        {/* Payment Method Card */}
        {refund.payment_method && (
          <div className="bg-background rounded-2xl border border-border p-4">
            <h3 className="font-bold text-foreground mb-3">Refund To</h3>
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <PaymentIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground capitalize">{refund.payment_method}</p>
                {refund.payment_details && (
                  <p className="text-xs text-muted-foreground">{refund.payment_details}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="bg-background rounded-2xl border border-border p-4">
          <h3 className="font-bold text-foreground mb-4">Refund Timeline</h3>
          <div className="space-y-0">
            {events.length === 0 ? (
              <div className="flex items-center gap-3 p-3">
                <div className="w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 text-warning animate-spin" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Processing</p>
                  <p className="text-xs text-muted-foreground">Refund initiated, awaiting processing</p>
                </div>
              </div>
            ) : (
              events.map((event, index) => (
                <div key={event.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      event.status === 'completed' ? 'bg-success/10 text-success' :
                      event.status === 'failed' ? 'bg-destructive/10 text-destructive' :
                      'bg-warning/10 text-warning'
                    }`}>
                      {event.status === 'completed' ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : event.status === 'failed' ? (
                        <AlertCircle className="w-4 h-4" />
                      ) : (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      )}
                    </div>
                    {index < events.length - 1 && (
                      <div className="w-0.5 h-10 bg-border" />
                    )}
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-medium text-foreground">{event.title}</p>
                    {event.description && (
                      <p className="text-xs text-muted-foreground">{event.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(event.created_at), 'MMM d, h:mm a')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 pb-6 z-40">
        <div className="flex gap-3 max-w-lg mx-auto">
          {order && (
            <Link
              to={`/orders/${order.id}`}
              className="flex-1 h-12 border border-border rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-muted transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              View Order
            </Link>
          )}
          <Link
            to="/dashboard"
            className="flex-1 h-12 bg-primary text-primary-foreground rounded-xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}