import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';

interface Refund {
  id: string;
  public_refund_id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  reason: string | null;
  failure_reason: string | null;
  retry_allowed: boolean;
  payment_method: string | null;
  payment_details: string | null;
  transaction_id: string | null;
  payment_transactions: {
    public_transaction_id: string | null;
  } | null;
  receipt_url: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  orders: {
    public_order_id: string;
    order_number: string;
    product_name: string;
    status: string;
    merchant_id: string;
  } | null;
}

interface RefundEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  status: string | null;
  created_at: string;
}

const statusConfig: Record<string, { label: string; className: string; icon: string }> = {
  initiated: { label: 'Initiated', className: 'bg-primary/10 text-primary', icon: 'schedule' },
  processing: { label: 'Processing', className: 'bg-warning/10 text-warning', icon: 'sync' },
  success: { label: 'Completed', className: 'bg-success/10 text-success', icon: 'check_circle' },
  failed: { label: 'Failed', className: 'bg-destructive/10 text-destructive', icon: 'error' },
};

export default function MerchantRefundDetail() {
  const { refundId } = useParams<{ refundId: string }>();
  const { merchant } = useMerchantAuth();
  const navigate = useNavigate();
  const [refund, setRefund] = useState<Refund | null>(null);
  const [events, setEvents] = useState<RefundEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!refundId || !merchant?.id) return;

    const fetchRefund = async () => {
      try {
        const { data, error } = await supabase
          .from('refunds')
          .select('*, orders(public_order_id, order_number, product_name, status, merchant_id), payment_transactions(public_transaction_id)')
          .eq('id', refundId)
          .eq('orders.merchant_id', merchant.id)
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          navigate('/merchant-refunds');
          return;
        }
        setRefund(data);

        const { data: eventsData } = await supabase
          .from('refund_events')
          .select('*')
          .eq('refund_id', refundId)
          .order('created_at', { ascending: false });

        setEvents(eventsData || []);
      } catch (error) {
        console.error('Error fetching refund:', error);
        toast({ title: 'Error', description: 'Failed to load refund', variant: 'destructive' });
        navigate('/merchant-refunds');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRefund();
  }, [refundId, merchant?.id, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!refund) return null;

  const config = statusConfig[refund.status] || statusConfig.initiated;

  return (
    <div className="mobile-page">
      <header className="sticky-header bg-card">
        <div className="sticky-header-content px-4 sm:px-6">
          <button onClick={() => navigate('/merchant-refunds')} className="back-btn">
            <span className="material-symbols-outlined text-xl sm:text-2xl">arrow_back</span>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm sm:text-base font-semibold text-foreground">Refund Details</h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground font-mono">{refund.public_refund_id || `#${refund.id.slice(0, 8).toUpperCase()}`}</p>
          </div>
          <span className={`text-[10px] sm:text-xs px-2 py-1 rounded-full capitalize shrink-0 flex items-center gap-1 ${config.className}`}>
            <span className="material-symbols-outlined text-xs">{config.icon}</span>
            {config.label}
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto mobile-section pb-24 space-y-4">
        {/* Amount */}
        <div className="bg-card border border-border rounded-xl p-5 text-center">
          <p className="text-xs text-muted-foreground mb-1">Refund Amount</p>
          <p className="text-3xl font-extrabold text-foreground">
            {refund.currency === 'USD' ? '$' : '₹'}{Number(refund.amount).toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1 capitalize">
            {refund.reason?.replace(/_/g, ' ') || 'Refund'}
          </p>
        </div>

        {/* Details */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Details</h2>
          {refund.orders && (
            <>
              <div className="flex justify-between items-center py-1.5 border-b border-border">
                <span className="text-xs text-muted-foreground">Order</span>
                <span className="text-xs font-medium text-foreground font-mono">{refund.orders.public_order_id || `#${refund.orders.order_number}`}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-border">
                <span className="text-xs text-muted-foreground">Product</span>
                <span className="text-xs font-medium text-foreground text-right max-w-[60%]">{refund.orders.product_name}</span>
              </div>
            </>
          )}
          {refund.transaction_id && (
            <div className="flex justify-between items-center py-1.5 border-b border-border">
              <span className="text-xs text-muted-foreground">Payment Transaction</span>
              <span className="text-xs font-medium text-foreground font-mono">{refund.payment_transactions?.public_transaction_id || refund.transaction_id}</span>
            </div>
          )}
          {refund.payment_method && (
            <div className="flex justify-between items-center py-1.5 border-b border-border">
              <span className="text-xs text-muted-foreground">Payment Method</span>
              <span className="text-xs font-medium text-foreground capitalize">{refund.payment_method.replace(/_/g, ' ')}</span>
            </div>
          )}
          {refund.failure_reason && (
            <div className="flex justify-between items-center py-1.5 border-b border-border">
              <span className="text-xs text-muted-foreground">Failure Reason</span>
              <span className="text-xs font-medium text-destructive text-right max-w-[60%]">{refund.failure_reason}</span>
            </div>
          )}
          <div className="flex justify-between items-center py-1.5">
            <span className="text-xs text-muted-foreground">Requested</span>
            <span className="text-xs font-medium text-foreground">{format(new Date(refund.created_at), 'MMM d, yyyy h:mm a')}</span>
          </div>
          {refund.completed_at && (
            <div className="flex justify-between items-center py-1.5 border-t border-border">
              <span className="text-xs text-muted-foreground">Completed</span>
              <span className="text-xs font-medium text-foreground">{format(new Date(refund.completed_at), 'MMM d, yyyy h:mm a')}</span>
            </div>
          )}
        </div>

        {/* Timeline */}
        {events.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4">
            <h2 className="text-sm font-semibold text-foreground mb-4">Timeline</h2>
            <div className="space-y-0">
              {[...events].reverse().map((event, index) => (
                <div key={event.id} className="flex gap-3 relative pb-4">
                  {index < events.length - 1 && (
                    <div className="absolute left-[15px] top-7 bottom-0 w-0.5 bg-border" />
                  )}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 relative z-10 ${
                    event.status === 'failed' ? 'bg-destructive/10 text-destructive'
                    : event.status === 'completed' ? 'bg-success/10 text-success'
                    : event.status === 'success' ? 'bg-success/10 text-success'
                    : 'bg-primary/10 text-primary'
                  }`}>
                    <span className="material-symbols-outlined text-base">
                      {event.status === 'failed' ? 'error' : event.status === 'completed' || event.status === 'success' ? 'check' : 'circle'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-sm font-medium text-foreground">{event.title}</p>
                    {event.description && (
                      <p className="text-xs text-muted-foreground">{event.description}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {format(new Date(event.created_at), 'MMM d, h:mm a')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          {refund.orders && (
            <Link
              to={`/merchant-order/${refund.order_id}`}
              className="flex items-center justify-center gap-2 h-11 bg-card border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
            >
              <span className="material-symbols-outlined text-base">receipt_long</span>
              View Order
            </Link>
          )}
          <Link
            to="/merchant-support"
            className="flex items-center justify-center gap-2 h-11 bg-card border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
          >
            <span className="material-symbols-outlined text-base">support_agent</span>
            Contact Support
          </Link>
        </div>
      </main>
    </div>
  );
}
