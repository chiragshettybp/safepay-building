import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Gavel,
  Package,
  RotateCcw,
  ShoppingCart,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MerchantPageHeader } from '@/components/merchant/MerchantPageHeader';
import { StatusBadge, type StatusTone } from '@/components/shared/StatusBadge';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { MerchantBottomNav } from '@/components/shared/MerchantBottomNav';
import { formatAmount } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Refund {
  id: string;
  public_refund_id: string | null;
  order_id: string;
  dispute_id: string | null;
  customer_id: string;
  amount: number;
  currency: string | null;
  status: string;
  reason: string | null;
  failure_reason: string | null;
  retry_allowed: boolean;
  payment_method: string | null;
  payment_details: string | null;
  transaction_id: string | null;
  receipt_url: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface OrderRow {
  id: string;
  merchant_id: string;
  public_order_id: string | null;
  order_number: string;
  product_name: string;
  amount: number;
  currency: string | null;
  status: string;
  escrow_status: string | null;
  created_at: string;
}

interface RefundEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  status: string | null;
  created_at: string;
}

interface TxRow {
  id: string;
  public_payment_id: string | null;
  amount: number;
  currency: string | null;
  status: string;
  created_at: string;
}

interface DisputeRow {
  id: string;
  public_dispute_id: string | null;
  status: string;
  created_at: string;
}

interface ProductRow {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  image_url: string | null;
  quantity: number;
}

const STATUS: Record<string, { tone: StatusTone; label: string }> = {
  initiated: { tone: 'info', label: 'Initiated' },
  processing: { tone: 'warning', label: 'Processing' },
  success: { tone: 'success', label: 'Completed' },
  failed: { tone: 'destructive', label: 'Failed' },
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="break-all text-right text-xs font-medium text-foreground">{value}</span>
    </div>
  );
}

function LinkRow({ label, value, to, icon: Icon }: { label: string; value: string; to: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 transition-all hover:border-primary/30 active:scale-[0.99]"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{value}</p>
        <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      </div>
    </Link>
  );
}

function TimelineIcon({ tone }: { tone: StatusTone }) {
  const cls =
    tone === 'success'
      ? 'bg-success/10 text-success'
      : tone === 'destructive'
        ? 'bg-destructive/10 text-destructive'
        : tone === 'warning'
          ? 'bg-warning/10 text-warning'
          : 'bg-primary/10 text-primary';
  return (
    <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', cls)}>
      {tone === 'success' ? <CheckCircle2 className="h-4 w-4" /> : tone === 'destructive' ? <AlertCircle className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
    </div>
  );
}

export default function MerchantRefundDetail() {
  const { refundId } = useParams<{ refundId: string }>();
  const navigate = useNavigate();
  const { merchant } = useMerchantAuth();

  const [refund, setRefund] = useState<Refund | null>(null);
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [events, setEvents] = useState<RefundEvent[]>([]);
  const [customerName, setCustomerName] = useState<string>('');
  const [tx, setTx] = useState<TxRow | null>(null);
  const [dispute, setDispute] = useState<DisputeRow | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!refundId || !merchant?.id) return;
    setIsLoading(true);
    try {
      const { data: refundData, error: refundError } = await supabase.from('refunds').select('*').eq('id', refundId).single();
      if (refundError) throw refundError;
      setRefund(refundData as Refund);

      const { data: orderData } = await supabase
        .from('orders')
        .select('id, merchant_id, public_order_id, order_number, product_name, amount, currency, status, escrow_status, created_at')
        .eq('id', refundData.order_id)
        .single();

      if (!orderData || orderData.merchant_id !== merchant.id) {
        toast.error('Access denied');
        navigate('/merchant-refunds');
        return;
      }
      setOrder(orderData as OrderRow);

      const [eventsRes, customerRes, txRes, disputeRes, itemsRes] = await Promise.all([
        supabase.from('refund_events').select('*').eq('refund_id', refundId).order('created_at', { ascending: false }),
        supabase.from('profiles').select('full_name').eq('id', refundData.customer_id).maybeSingle(),
        supabase
          .from('payment_transactions')
          .select('id, public_payment_id, amount, currency, status, created_at')
          .eq('order_id', refundData.order_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        refundData.dispute_id
          ? supabase.from('disputes').select('id, public_dispute_id, status, created_at').eq('id', refundData.dispute_id).maybeSingle()
          : supabase.from('disputes').select('id, public_dispute_id, status, created_at').eq('order_id', refundData.order_id).limit(1).maybeSingle(),
        supabase
          .from('order_items')
          .select('quantity, products(id, name, sku, price, image_url)')
          .eq('order_id', refundData.order_id),
      ]);

      setEvents((eventsRes.data ?? []) as RefundEvent[]);
      setCustomerName(customerRes.data?.full_name ?? 'Customer');
      setTx((txRes.data as TxRow | null) ?? null);
      setDispute((disputeRes.data as DisputeRow | null) ?? null);
      setProducts(
        (itemsRes.data ?? [])
          .map((r: any) => r.products)
          .filter(Boolean)
          .map((p: any, i: number) => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            price: Number(p.price),
            image_url: p.image_url,
            quantity: (itemsRes.data as any[])[i].quantity,
          })),
      );
    } catch (error) {
      console.error('Refund fetch error:', error);
      toast.error('Failed to load refund');
      navigate('/merchant-refunds');
    } finally {
      setIsLoading(false);
    }
  }, [refundId, merchant?.id, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!refundId) return;
    const channel = supabase
      .channel(`merchant-refund-${refundId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'refunds', filter: `id=eq.${refundId}` }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'refund_events', filter: `refund_id=eq.${refundId}` }, () => fetchData())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refundId, fetchData]);

  const isFull = useMemo(() => {
    if (!refund || !order) return false;
    return Number(refund.amount) >= Number(order.amount);
  }, [refund, order]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-5 pb-16 sm:px-6 sm:py-7">
        <Skeleton className="mb-4 h-9 w-56 rounded-lg" />
        <Skeleton className="mb-4 h-32 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!refund || !order) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="mb-4 text-muted-foreground">Refund not found</p>
        <Button variant="outline" onClick={() => navigate('/merchant-refunds')}>
          Back to Refunds
        </Button>
      </div>
    );
  }

  const config = STATUS[refund.status] ?? { tone: 'neutral' as StatusTone, label: refund.status };
  const escrowTone: StatusTone = order.escrow_status === 'refunded' ? 'neutral' : order.escrow_status === 'released' ? 'success' : 'warning';
  const escrowLabel = order.escrow_status === 'refunded' ? 'Refunded' : order.escrow_status === 'released' ? 'Released' : order.escrow_status === 'held' ? 'Held in escrow' : order.escrow_status ?? '—';

  return (
    <>
      <div className="mx-auto max-w-3xl px-4 py-5 pb-16 sm:px-6 sm:py-7">
        <MerchantPageHeader
          title={refund.public_refund_id ?? `Refund ${refund.id.slice(0, 8)}`}
          subtitle={`Requested ${new Date(refund.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`}
          back={{ fallback: '/merchant-refunds', label: 'Back to Refunds' }}
          actions={<StatusBadge tone={config.tone} label={config.label} dot />}
        />

        {/* Amount */}
        <Card className="mb-4 p-5">
          <p className="text-xs font-medium text-muted-foreground">Refund Amount</p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-foreground">{formatAmount(refund.amount, refund.currency)}</p>
          <p className="mt-1 text-xs text-muted-foreground capitalize">
            {refund.reason?.replace(/_/g, ' ') || 'Refund'} · {isFull ? 'Full refund' : 'Partial refund'}
          </p>
        </Card>

        {/* Financial impact */}
        <Card className="mb-4 p-4">
          <h2 className="mb-2 text-sm font-semibold text-foreground">Financial Impact</h2>
          <div className="divide-y divide-border">
            <Row label="Order amount" value={formatAmount(order.amount, order.currency)} />
            <Row label="Refund amount" value={formatAmount(refund.amount, refund.currency)} />
            <Row label="Type" value={isFull ? 'Full refund' : 'Partial refund'} />
            <Row label="SafePay status" value={<StatusBadge tone={escrowTone} label={escrowLabel} dot className="text-[10px] px-1.5 py-0.5" />} />
            <Row
              label="Wallet impact"
              value={<span className={refund.status === 'success' ? 'text-destructive' : 'text-muted-foreground'}>{refund.status === 'success' ? 'Deducted from protected funds' : 'Pending deduction'}</span>}
            />
          </div>
        </Card>

        {/* Details */}
        <Card className="mb-4 p-4">
          <h2 className="mb-2 text-sm font-semibold text-foreground">Details</h2>
          <div className="divide-y divide-border">
            <Row label="Order" value={order.public_order_id ?? `#${order.order_number}`} />
            <Row label="Product" value={order.product_name} />
            <Row label="Customer" value={customerName} />
            {tx && <Row label="Original transaction" value={tx.public_payment_id ?? 'Payment'} />}
            {refund.payment_method && <Row label="Payment method" value={refund.payment_method.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} />}
            {refund.payment_details && <Row label="Account" value={refund.payment_details} />}
            {refund.transaction_id && <Row label="Gateway transaction ref" value={refund.transaction_id} />}
            {refund.failure_reason && (
              <Row
                label="Failure reason"
                value={<span className="text-destructive">{refund.failure_reason}</span>}
              />
            )}
            <Row label="Updated" value={new Date(refund.updated_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} />
            {refund.completed_at && (
              <Row label="Completed" value={new Date(refund.completed_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} />
            )}
          </div>
        </Card>

        {/* Products */}
        {products.length > 0 && (
          <Card className="mb-4 p-4">
            <h2 className="mb-3 text-sm font-semibold text-foreground">Refunded items</h2>
            <div className="space-y-2">
              {products.map((p) => (
                <Link
                  key={p.id}
                  to={`/merchant-products/${p.id}`}
                  className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 p-3 transition-all hover:border-primary/30"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                    {p.image_url ? <img src={p.image_url} alt="" className="h-full w-full object-cover" /> : <Package className="h-5 w-5 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {p.sku ? `${p.sku} · ` : ''}
                      {p.quantity} unit{p.quantity === 1 ? '' : 's'}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-foreground">{formatAmount(p.price)}</p>
                </Link>
              ))}
            </div>
          </Card>
        )}

        {/* Timeline */}
        {events.length > 0 && (
          <Card className="mb-4 p-4">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Timeline</h2>
            <div className="space-y-0">
              {[...events].reverse().map((event, index) => {
                const tone: StatusTone = event.status === 'failed' ? 'destructive' : event.status === 'completed' || event.status === 'success' ? 'success' : event.status === 'processing' ? 'warning' : 'info';
                return (
                  <div key={event.id} className="relative flex gap-3 pb-4">
                    {index < events.length - 1 && <div className="absolute left-[15px] top-8 bottom-0 w-0.5 bg-border" />}
                    <TimelineIcon tone={tone} />
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="text-sm font-medium text-foreground">{event.title}</p>
                      {event.description && <p className="text-xs text-muted-foreground">{event.description}</p>}
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {new Date(event.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Linked records */}
        <div className="space-y-2">
          <LinkRow icon={ShoppingCart} label={`Order ${order.public_order_id ?? `#${order.order_number}`} · ${formatAmount(order.amount, order.currency)}`} value="View Order" to={`/merchant-order/${order.id}`} />
          {tx && <LinkRow icon={Wallet} label={`${formatAmount(tx.amount, tx.currency)} · ${tx.status}`} value="Original Transaction" to={`/merchant-transactions/${tx.id}`} />}
          {dispute && (
            <LinkRow
              icon={Gavel}
              label={`${dispute.public_dispute_id ?? 'Dispute'} · ${dispute.status.replace(/_/g, ' ')}`}
              value="Linked Dispute"
              to={`/merchant-dispute-response/${dispute.id}`}
            />
          )}
        </div>
      </div>
      <MerchantBottomNav />
    </>
  );
}
