import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDownRight, RefreshCw, RotateCcw, Search, Undo2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MerchantPageHeader } from '@/components/merchant/MerchantPageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge, type StatusTone } from '@/components/shared/StatusBadge';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { MerchantBottomNav } from '@/components/shared/MerchantBottomNav';
import { formatAmount } from '@/lib/format';
import { cn } from '@/lib/utils';

interface RefundRow {
  id: string;
  public_refund_id: string | null;
  order_id: string;
  amount: number;
  currency: string | null;
  status: string;
  reason: string | null;
  created_at: string;
  completed_at: string | null;
  orders: { public_order_id: string | null; order_number: string; product_name: string; customer_id: string } | null;
}

const STATUS_TONE: Record<string, { tone: StatusTone; label: string }> = {
  initiated: { tone: 'info', label: 'Initiated' },
  processing: { tone: 'warning', label: 'Processing' },
  success: { tone: 'success', label: 'Completed' },
  failed: { tone: 'destructive', label: 'Failed' },
};

const FILTERS: Array<{ key: 'all' | 'initiated' | 'processing' | 'success' | 'failed'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'initiated', label: 'Initiated' },
  { key: 'processing', label: 'Processing' },
  { key: 'success', label: 'Completed' },
  { key: 'failed', label: 'Failed' },
];

export default function MerchantRefunds() {
  const { merchant } = useMerchantAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const statusParam = searchParams.get('status');
  const [filter, setFilter] = useState<'all' | 'initiated' | 'processing' | 'success' | 'failed'>(() => {
    const v = searchParams.get('status');
    return v && (['initiated', 'processing', 'success', 'failed'] as string[]).includes(v) ? (v as typeof filter) : 'all';
  });

  const refresh = useCallback(async () => {
    if (!merchant?.id) return;
    setLoading(true);
    setError(null);
    try {
      const { data: orderData, error: ordersError } = await supabase
        .from('orders')
        .select('id, public_order_id, order_number, product_name')
        .eq('merchant_id', merchant.id);
      if (ordersError) throw ordersError;
      const orderIds = (orderData ?? []).map((o) => o.id);
      const orderMap = new Map((orderData ?? []).map((o) => [o.id, o]));

      let data: any[] = [];
      if (orderIds.length > 0) {
        const { data: refundData, error: fetchError } = await supabase
          .from('refunds')
          .select('id, public_refund_id, order_id, amount, currency, status, reason, created_at, completed_at, customer_id')
          .in('order_id', orderIds)
          .order('created_at', { ascending: false })
          .limit(100);
        if (fetchError) {
          setError('Unable to load refunds right now.');
          return;
        }
        data = refundData ?? [];
      }
      const rows: RefundRow[] = (data as any[]).map((r) => {
        const o = orderMap.get(r.order_id);
        return {
          ...r,
          orders: o
            ? { public_order_id: o.public_order_id, order_number: o.order_number, product_name: o.product_name, customer_id: r.customer_id }
            : null,
        };
      });
      setRefunds(rows);
    } catch {
      setError('Something went wrong while loading your refunds.');
    } finally {
      setLoading(false);
    }
  }, [merchant?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!merchant?.id) return;
    const channel = supabase
      .channel(`merchant-refunds-${merchant.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'refunds' }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [merchant?.id, refresh]);

  useEffect(() => {
    const v = searchParams.get('status');
    const next = v && (['initiated', 'processing', 'success', 'failed'] as string[]).includes(v) ? (v as typeof filter) : 'all';
    setFilter(next);
    setQuery('');
  }, [statusParam, searchParams]);

  const filtered = useMemo(() => {
    let list = refunds;
    if (filter !== 'all') list = list.filter((r) => r.status === filter);
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(
        (r) =>
          (r.public_refund_id ?? '').toLowerCase().includes(q) ||
          (r.orders?.public_order_id ?? '').toLowerCase().includes(q) ||
          (r.orders?.order_number ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [refunds, filter, query]);

  const counts = useMemo(() => {
    const inProgress = refunds.filter((r) => r.status === 'initiated' || r.status === 'processing').length;
    const success = refunds.filter((r) => r.status === 'success').length;
    const failed = refunds.filter((r) => r.status === 'failed').length;
    const total = refunds.reduce((s, r) => s + Number(r.amount), 0);
    return { inProgress, success, failed, total };
  }, [refunds]);

  return (
    <>
      <div className="mx-auto max-w-5xl px-4 py-5 pb-16 sm:px-6 sm:py-7">
        <MerchantPageHeader
          title="Refunds"
          subtitle="Money returned to customers on your orders."
          actions={
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4 mr-1.5', loading && 'animate-spin')} /> Refresh
            </Button>
          }
        />

        {loading ? (
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="mb-5 grid grid-cols-3 gap-3">
            <Card className="p-4">
              <p className="text-xs font-medium text-muted-foreground">In Progress</p>
              <p className="mt-1 text-xl font-bold text-foreground">{counts.inProgress}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-medium text-muted-foreground">Completed</p>
              <p className="mt-1 text-xl font-bold text-success">{counts.success}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-medium text-muted-foreground">Failed</p>
              <p className="mt-1 text-xl font-bold text-destructive">{counts.failed}</p>
            </Card>
          </div>
        )}

        {error && (
          <Card className="mb-4 flex items-center justify-between gap-3 border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm text-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={refresh}>
              Try Again
            </Button>
          </Card>
        )}

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 overflow-x-auto rounded-lg border border-border p-0.5 w-fit">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => {
                  setFilter(f.key);
                  setSearchParams(f.key === 'all' ? {} : { status: f.key }, { replace: true });
                }}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
                  filter === f.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search refunds..." className="h-9 pl-9" />
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Undo2}
            title={query || filter !== 'all' ? 'No matching refunds' : 'No refunds yet'}
            description={query || filter !== 'all' ? 'Try a different search or filter.' : 'Refunds issued on your orders will appear here.'}
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((refund) => {
              const config = STATUS_TONE[refund.status] ?? { tone: 'neutral' as StatusTone, label: refund.status };
              return (
                <Link
                  key={refund.id}
                  to={`/merchant-refunds/${refund.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 transition-all hover:border-primary/30 active:scale-[0.99]"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                    <RotateCcw className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{formatAmount(refund.amount, refund.currency)}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      <span className="font-mono">{refund.public_refund_id ?? 'Refund'}</span> · {refund.reason?.replace(/_/g, ' ') ?? 'Order refund'} ·{' '}
                      {new Date(refund.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                    </p>
                    {refund.orders?.public_order_id && (
                      <p className="truncate text-[11px] text-muted-foreground font-mono">
                        {refund.orders.public_order_id} · {refund.orders.product_name}
                      </p>
                    )}
                  </div>
                  <div className="hidden shrink-0 sm:block">
                    <StatusBadge tone={config.tone} label={config.label} dot className="text-[10px] px-1.5 py-0.5" />
                  </div>
                  <ArrowDownRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                </Link>
              );
            })}
          </div>
        )}
      </div>
      <MerchantBottomNav />
    </>
  );
}
