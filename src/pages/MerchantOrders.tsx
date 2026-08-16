import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Scale,
  Search,
  Truck,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import { MerchantBottomNav } from '@/components/shared/MerchantBottomNav';
import { MerchantPageHeader } from '@/components/merchant/MerchantPageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge, type StatusTone } from '@/components/shared/StatusBadge';
import { FullPageLoading } from '@/components/shared/LoadingSpinner';
import { formatAmount } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  public_order_id: string;
  order_number: string;
  product_name: string;
  amount: number;
  currency: string;
  status: string;
  escrow_status: string;
  created_at: string;
  expected_delivery: string | null;
  customer_id: string;
  has_tracking?: boolean;
  has_proof?: boolean;
  dispute_id?: string | null;
}

type StatusFilter = 'all' | 'pending' | 'in_transit' | 'delivered' | 'completed' | 'disputed' | 'refunded';

const FILTER_PILLS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'in_transit', label: 'In Transit' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'completed', label: 'Completed' },
  { key: 'disputed', label: 'Disputed' },
  { key: 'refunded', label: 'Refunded' },
];

const STATUS_CONFIG: Record<string, { tone: StatusTone; label: string }> = {
  pending: { tone: 'neutral', label: 'Pending' },
  awaiting_shipment: { tone: 'neutral', label: 'Awaiting' },
  in_transit: { tone: 'info', label: 'In Transit' },
  shipped: { tone: 'info', label: 'Shipped' },
  in_progress: { tone: 'info', label: 'In Transit' },
  delivered: { tone: 'success', label: 'Delivered' },
  completed: { tone: 'success', label: 'Completed' },
  disputed: { tone: 'destructive', label: 'Disputed' },
  refunded: { tone: 'neutral', label: 'Refunded' },
  cancelled: { tone: 'neutral', label: 'Cancelled' },
};

function orderVisual(status: string): { icon: typeof Package; cls: string } {
  if (status === 'disputed') return { icon: AlertCircle, cls: 'bg-destructive/10 text-destructive' };
  if (status === 'shipped' || status === 'in_transit' || status === 'in_progress') return { icon: Truck, cls: 'bg-primary/10 text-primary' };
  if (status === 'delivered' || status === 'completed') return { icon: CheckCircle2, cls: 'bg-success/10 text-success' };
  if (status === 'refunded') return { icon: RotateCcw, cls: 'bg-muted text-muted-foreground' };
  if (status === 'cancelled') return { icon: XCircle, cls: 'bg-muted text-muted-foreground' };
  return { icon: Package, cls: 'bg-muted text-muted-foreground' };
}

export default function MerchantOrders() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { merchant, isAuthenticated, isLoading: authLoading } = useMerchantAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const statusParam = searchParams.get('status');
  const searchQuery = searchParams.get('q') ?? '';
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const v = searchParams.get('status');
    const allowed: StatusFilter[] = FILTER_PILLS.map((p) => p.key);
    return v && (allowed as string[]).includes(v) ? (v as StatusFilter) : 'all';
  });

  useEffect(() => {
    const allowed: StatusFilter[] = FILTER_PILLS.map((p) => p.key);
    const next = statusParam && (allowed as string[]).includes(statusParam) ? (statusParam as StatusFilter) : 'all';
    setStatusFilter(next);
  }, [statusParam]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/merchant-login', { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (merchant && merchant.verificationStatus !== 'approved') {
      navigate('/merchant-verify', { replace: true });
    }
  }, [merchant, navigate]);

  const fetchOrders = useCallback(async () => {
    if (!merchant?.id) return;

    try {
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select('id, public_order_id, order_number, product_name, amount, currency, status, escrow_status, created_at, expected_delivery, customer_id, merchant_id')
        .eq('merchant_id', merchant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const { data: trackingData } = await supabase
        .from('order_tracking')
        .select('order_id')
        .eq('merchant_id', merchant.id);

      const trackingOrderIds = new Set((trackingData || []).map((t: any) => t.order_id));

      const { data: proofsData } = await supabase
        .from('delivery_proofs')
        .select('order_id')
        .eq('merchant_id', merchant.id);

      const proofOrderIds = new Set((proofsData || []).map((p: any) => p.order_id));

      const merchantOrders: Order[] = (ordersData || []).map((o: any) => ({
        id: o.id,
        public_order_id: o.public_order_id,
        order_number: o.order_number,
        product_name: o.product_name,
        amount: o.amount,
        currency: o.currency,
        status: o.status,
        escrow_status: o.escrow_status,
        created_at: o.created_at,
        expected_delivery: o.expected_delivery,
        customer_id: o.customer_id,
        has_tracking: trackingOrderIds.has(o.id),
        has_proof: proofOrderIds.has(o.id),
      }));

      const disputedIds = merchantOrders.filter((o) => o.status === 'disputed').map((o) => o.id);
      if (disputedIds.length > 0) {
        const { data: disputesData } = await supabase
          .from('disputes')
          .select('id, order_id')
          .in('order_id', disputedIds);
        const disputeMap = new Map((disputesData || []).map((d: any) => [d.order_id, d.id]));
        merchantOrders.forEach((o) => {
          o.dispute_id = disputeMap.get(o.id) ?? null;
        });
      }

      setOrders(merchantOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setIsLoading(false);
    }
  }, [merchant?.id]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (!merchant?.id) return;

    const channel = supabase
      .channel('merchant-orders-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_tracking' }, () => fetchOrders())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [merchant?.id, fetchOrders]);

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.public_order_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.product_name.toLowerCase().includes(searchQuery.toLowerCase());

    if (statusFilter === 'all') return matchesSearch;
    if (statusFilter === 'pending') {
      return matchesSearch && (order.status === 'pending' || order.status === 'awaiting_shipment');
    }
    if (statusFilter === 'in_transit') {
      return matchesSearch && (order.status === 'in_transit' || order.status === 'shipped' || order.status === 'in_progress');
    }
    return matchesSearch && order.status === statusFilter;
  });

  const pillCount = (key: StatusFilter) => {
    if (key === 'all') return orders.length;
    if (key === 'pending') return orders.filter((o) => o.status === 'pending' || o.status === 'awaiting_shipment').length;
    if (key === 'in_transit') return orders.filter((o) => o.status === 'in_transit' || o.status === 'shipped' || o.status === 'in_progress').length;
    return orders.filter((o) => o.status === key).length;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });
  };

  const renderAction = (order: Order) => {
    if (order.status === 'disputed') {
      if (!order.dispute_id) return null;
      return (
        <Link to={`/merchant-dispute-response/${order.dispute_id}`}>
          <Button size="sm" variant="destructive" className="h-8 gap-1 text-xs">
            <Scale className="h-3.5 w-3.5" />
            Respond
          </Button>
        </Link>
      );
    }
    if (!order.has_tracking && (order.status === 'pending' || order.status === 'awaiting_shipment')) {
      return (
        <Link to={`/merchant-add-tracking/${order.id}`}>
          <Button size="sm" className="h-8 gap-1 text-xs">
            <Plus className="h-3.5 w-3.5" />
            Add Tracking
          </Button>
        </Link>
      );
    }
    if (order.has_tracking && order.status !== 'completed' && order.status !== 'refunded' && order.status !== 'cancelled') {
      return (
        <Link to={`/merchant-edit-tracking/${order.id}`}>
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs">
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        </Link>
      );
    }
    if (!order.has_proof && order.status !== 'pending' && order.status !== 'cancelled') {
      return (
        <Link to={`/merchant-delivery-proof/${order.id}`}>
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs">
            <UploadCloud className="h-3.5 w-3.5" />
            Proof
          </Button>
        </Link>
      );
    }
    return null;
  };

  if (authLoading || !isAuthenticated || !merchant) {
    return <FullPageLoading />;
  }

  return (
    <>
      <div className="mx-auto max-w-5xl px-4 py-5 pb-16 sm:px-6 sm:py-7">
        <MerchantPageHeader
          title="Orders"
          subtitle="Track, ship and fulfil every order."
          actions={
            <Button variant="outline" size="sm" onClick={fetchOrders} disabled={isLoading}>
              <RefreshCw className={cn('h-4 w-4 mr-1.5', isLoading && 'animate-spin')} /> Refresh
            </Button>
          }
        />

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search orders..."
            value={searchQuery}
            onChange={(e) => {
              const v = e.target.value;
              const next = new URLSearchParams(searchParams);
              if (v) next.set('q', v);
              else next.delete('q');
              setSearchParams(next, { replace: true });
            }}
            className="h-10 pl-9"
          />
        </div>

        <div className="mb-5 flex gap-1 overflow-x-auto rounded-lg border border-border p-0.5 scrollbar-hide">
          {FILTER_PILLS.map((pill) => (
            <button
              key={pill.key}
              onClick={() => setSearchParams(pill.key === 'all' ? {} : { status: pill.key }, { replace: true })}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
                statusFilter === pill.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {pill.label}
              <span
                className={cn(
                  'rounded-full px-1.5 text-[10px] font-bold',
                  statusFilter === pill.key ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground',
                  pill.key === 'disputed' && pillCount(pill.key) > 0 && statusFilter !== 'disputed' && 'bg-destructive/15 text-destructive',
                )}
              >
                {pillCount(pill.key)}
              </span>
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[104px] w-full rounded-2xl" />
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <EmptyState
            icon={Package}
            title={searchQuery || statusFilter !== 'all' ? 'No matching orders' : 'No orders yet'}
            description={
              searchQuery || statusFilter !== 'all'
                ? 'Try a different search or filter.'
                : 'New orders will appear here as they come in.'
            }
          />
        ) : (
          <div className="space-y-2.5">
            {filteredOrders.map((order) => {
              const config = STATUS_CONFIG[order.status] ?? { tone: 'neutral' as StatusTone, label: order.status };
              const visual = orderVisual(order.status);
              const action = renderAction(order);
              return (
                <div
                  key={order.id}
                  className="rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary/30"
                >
                  <Link to={`/merchant-order/${order.id}`} className="block">
                    <div className="flex items-start gap-3">
                      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', visual.cls)}>
                        <visual.icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-sm font-bold text-foreground">
                          {order.public_order_id || `#${order.order_number}`}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{order.product_name}</p>
                      </div>
                      <StatusBadge tone={config.tone} label={config.label} dot className="text-[10px] px-1.5 py-0.5" />
                    </div>
                  </Link>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/60 pt-3">
                    <Link to={`/merchant-order/${order.id}`} className="min-w-0">
                      <p className="text-base font-bold tabular-nums text-foreground">{formatAmount(order.amount, order.currency)}</p>
                      <p className="text-[11px] text-muted-foreground">{formatDate(order.created_at)}</p>
                    </Link>
                    {action ?? (
                      <Link
                        to={`/merchant-order/${order.id}`}
                        className="flex h-8 shrink-0 items-center gap-0.5 text-xs font-medium text-primary"
                      >
                        View
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <MerchantBottomNav />
    </>
  );
}
