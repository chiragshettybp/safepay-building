import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';

interface RefundRow {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  reason: string | null;
  created_at: string;
  completed_at: string | null;
  orders: {
    order_number: string;
    product_name: string;
    customer_id: string;
  } | null;
}

const statusConfig: Record<string, { label: string; className: string; icon: string }> = {
  initiated: { label: 'Initiated', className: 'bg-primary/10 text-primary', icon: 'schedule' },
  processing: { label: 'Processing', className: 'bg-warning/10 text-warning', icon: 'sync' },
  success: { label: 'Completed', className: 'bg-success/10 text-success', icon: 'check_circle' },
  failed: { label: 'Failed', className: 'bg-destructive/10 text-destructive', icon: 'error' },
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
          .select('id, order_id, amount, currency, status, reason, created_at, completed_at, orders(order_number, product_name, customer_id)')
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
            <span className="material-symbols-outlined text-xl sm:text-2xl">arrow_back</span>
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
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : refunds.length === 0 ? (
          <div className="text-center py-10 bg-card border border-border rounded-xl">
            <span className="material-symbols-outlined text-muted-foreground text-3xl">currency_rupee</span>
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
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {refund.orders?.order_number ? `#${refund.orders.order_number}` : 'Order'} • {refund.orders?.product_name || ''}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">
                        {refund.reason?.replace(/_/g, ' ') || 'Refund'} • {format(new Date(refund.created_at), 'MMM d, h:mm a')}
                      </p>
                    </div>
                    <span className={`text-[10px] sm:text-xs px-2 py-1 rounded-full capitalize shrink-0 flex items-center gap-1 ${config.className}`}>
                      <span className="material-symbols-outlined text-xs">{config.icon}</span>
                      {config.label}
                    </span>
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
