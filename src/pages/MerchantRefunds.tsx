import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from '@/lib/toast';
import { ArrowLeft, IndianRupee } from 'lucide-react';
import { StatusBadge, type StatusTone } from '@/components/shared/StatusBadge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

interface RefundRow {
  id: string;
  public_refund_id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  reason: string | null;
  created_at: string;
  completed_at: string | null;
  orders: {
    public_order_id: string;
    order_number: string;
    product_name: string;
    customer_id: string;
  }[] | null;
}

const statusConfig: Record<string, { tone: StatusTone; label: string }> = {
  initiated: { tone: 'info', label: 'Initiated' },
  processing: { tone: 'warning', label: 'Processing' },
  success: { tone: 'success', label: 'Completed' },
  failed: { tone: 'destructive', label: 'Failed' },
};

const formatAmount = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency === 'USD' ? 'USD' : 'INR',
    maximumFractionDigits: 0,
  }).format(amount);

export default function MerchantRefunds() {
  const { merchant } = useMerchantAuth();
  const navigate = useNavigate();
  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!merchant?.id) return;

    const fetchRefunds = async () => {
      try {
        const { data, error } = await supabase
          .from('refunds')
          .select('id, public_refund_id, order_id, amount, currency, status, reason, created_at, completed_at, orders(public_order_id, order_number, product_name, customer_id)')
          .eq('orders.merchant_id', merchant.id)
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) throw error;
        setRefunds(data || []);
      } catch (error) {
        console.error('Error fetching refunds:', error);
        toast({ title: 'Error', description: 'Failed to load refunds', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchRefunds();

    const channel = supabase
      .channel('merchant-refunds-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'refunds',
      }, () => fetchRefunds())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [merchant?.id]);

  const counts = {
    initiated: refunds.filter(r => r.status === 'initiated' || r.status === 'processing').length,
    success: refunds.filter(r => r.status === 'success').length,
    failed: refunds.filter(r => r.status === 'failed').length,
  };

  return (
    <div className="mobile-page">
      <header className="sticky-header bg-card">
        <div className="sticky-header-content px-4 sm:px-6">
          <button onClick={() => navigate('/merchant-dashboard')} className="back-btn">
            <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm sm:text-base font-semibold text-foreground">Refunds</h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Refunds on your orders</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto mobile-section pb-24 space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-foreground">{counts.initiated}</p>
            <p className="text-[10px] text-muted-foreground">In Progress</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-success">{counts.success}</p>
            <p className="text-[10px] text-muted-foreground">Completed</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-destructive">{counts.failed}</p>
            <p className="text-[10px] text-muted-foreground">Failed</p>
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-10">
            <LoadingSpinner className="h-6 w-6" />
          </div>
        ) : refunds.length === 0 ? (
          <div className="text-center py-10 bg-card border border-border rounded-xl">
            <IndianRupee className="h-7 w-7 text-muted-foreground mx-auto" />
            <p className="text-foreground font-medium text-sm mt-2">No refunds yet</p>
            <p className="text-muted-foreground text-xs">Refunds will appear here when issued on your orders</p>
          </div>
        ) : (
          <div className="space-y-2">
            {refunds.map((refund) => {
              const config = statusConfig[refund.status] || statusConfig.initiated;
              return (
                <Link
                  key={refund.id}
                  to={`/merchant-refunds/${refund.id}`}
                  className="block p-4 bg-card rounded-xl border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm">
                        {formatAmount(Number(refund.amount), refund.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5 font-mono">
                        {refund.public_refund_id || (refund.orders?.[0]?.order_number ? `#${refund.orders[0].order_number}` : 'Refund')}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">
                        {refund.reason?.replace(/_/g, ' ') || 'Refund'} • {format(new Date(refund.created_at), 'MMM d, h:mm a')}
                      </p>
                      {refund.orders?.[0]?.public_order_id && (
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {refund.orders[0].public_order_id} • {refund.orders[0].product_name || ''}
                        </p>
                      )}
                    </div>
                    <StatusBadge tone={config.tone} label={config.label} className="text-[10px] sm:text-xs px-2 py-1 capitalize shrink-0" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
