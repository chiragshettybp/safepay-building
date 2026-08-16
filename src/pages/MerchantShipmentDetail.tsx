import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Gavel,
  Package,
  Pencil,
  Plane,
  Plus,
  RotateCcw,
  ShoppingCart,
  Truck,
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
  tracking_number: string | null;
  carrier: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  expected_delivery: string | null;
  created_at: string;
}

interface TrackingRow {
  id: string;
  order_id: string;
  tracking_number: string | null;
  courier_partner: string | null;
  shipment_date: string | null;
  estimated_delivery: string | null;
  actual_delivery: string | null;
  status: string | null;
  notes: string | null;
  created_at: string;
}

interface TrackingUpdate {
  id: string;
  status: string | null;
  location: string | null;
  description: string | null;
  created_at: string;
}

interface ProductLink {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  image_url: string | null;
  quantity: number;
}

interface RefundLink {
  id: string;
  public_refund_id: string | null;
  amount: number;
  currency: string | null;
  status: string;
  reason: string | null;
  created_at: string;
}

interface DisputeLink {
  id: string;
  public_dispute_id: string | null;
  status: string;
  created_at: string;
}

interface TxLink {
  id: string;
  public_payment_id: string | null;
  amount: number;
  currency: string | null;
  status: string;
  created_at: string;
}

interface TimelineEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  tone: StatusTone;
  done: boolean;
}

const TRACK_STATUS: Record<string, { tone: StatusTone; label: string }> = {
  pending: { tone: 'neutral', label: 'Pending' },
  shipped: { tone: 'info', label: 'Shipped' },
  picked_up: { tone: 'info', label: 'Picked up' },
  in_transit: { tone: 'info', label: 'In Transit' },
  out_for_delivery: { tone: 'info', label: 'Out for delivery' },
  delivered: { tone: 'success', label: 'Delivered' },
  failed: { tone: 'destructive', label: 'Failed' },
  returned: { tone: 'neutral', label: 'Returned' },
};

const ORDER_STATUS: Record<string, { tone: StatusTone; label: string }> = {
  pending: { tone: 'neutral', label: 'Pending' },
  awaiting_shipment: { tone: 'neutral', label: 'Awaiting Shipment' },
  shipped: { tone: 'info', label: 'Shipped' },
  in_transit: { tone: 'info', label: 'In Transit' },
  delivered: { tone: 'info', label: 'Delivered' },
  completed: { tone: 'success', label: 'Completed' },
  disputed: { tone: 'destructive', label: 'Disputed' },
  refunded: { tone: 'neutral', label: 'Refunded' },
  cancelled: { tone: 'neutral', label: 'Cancelled' },
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="break-all text-right text-xs font-medium text-foreground">{value}</span>
    </div>
  );
}

function TimelineIcon({ tone, done }: { tone: StatusTone; done: boolean }) {
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
      {done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
    </div>
  );
}

export default function MerchantShipmentDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { merchant } = useMerchantAuth();

  const [order, setOrder] = useState<OrderRow | null>(null);
  const [tracking, setTracking] = useState<TrackingRow | null>(null);
  const [updates, setUpdates] = useState<TrackingUpdate[]>([]);
  const [products, setProducts] = useState<ProductLink[]>([]);
  const [refunds, setRefunds] = useState<RefundLink[]>([]);
  const [dispute, setDispute] = useState<DisputeLink | null>(null);
  const [tx, setTx] = useState<TxLink | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!orderId || !merchant?.id) return;
    setIsLoading(true);
    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('id, merchant_id, public_order_id, order_number, product_name, amount, currency, status, escrow_status, tracking_number, carrier, shipped_at, delivered_at, expected_delivery, created_at')
        .eq('id', orderId)
        .single();
      if (orderError) throw orderError;
      if (orderData.merchant_id !== merchant.id) {
        toast.error('Access denied');
        navigate('/merchant-shipments');
        return;
      }
      setOrder(orderData as OrderRow);

      const { data: trackingData } = await supabase
        .from('order_tracking')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle();
      setTracking((trackingData as TrackingRow | null) ?? null);

      let updatesData: TrackingUpdate[] = [];
      if (trackingData) {
        const { data } = await supabase
          .from('tracking_updates')
          .select('id, status, location, description, created_at')
          .eq('tracking_id', trackingData.id)
          .order('created_at', { ascending: true });
        updatesData = (data ?? []) as TrackingUpdate[];
      }
      setUpdates(updatesData);

      const { data: itemsData } = await supabase
        .from('order_items')
        .select('product_id, quantity, products(id, name, sku, price, image_url)')
        .eq('order_id', orderId);
      setProducts(
        (itemsData ?? [])
          .map((r: any) => r.products)
          .filter(Boolean)
          .map((p: any, i: number) => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            price: Number(p.price),
            image_url: p.image_url,
            quantity: (itemsData as any[])[i].quantity,
          })),
      );

      const [refundRes, disputeRes, txRes] = await Promise.all([
        supabase
          .from('refunds')
          .select('id, public_refund_id, amount, currency, status, reason, created_at')
          .eq('order_id', orderId)
          .order('created_at', { ascending: false }),
        supabase
          .from('disputes')
          .select('id, public_dispute_id, status, created_at')
          .eq('order_id', orderId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('payment_transactions')
          .select('id, public_payment_id, amount, currency, status, created_at')
          .eq('order_id', orderId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      setRefunds((refundRes.data ?? []) as RefundLink[]);
      setDispute((disputeRes.data as DisputeLink | null) ?? null);
      setTx((txRes.data as TxLink | null) ?? null);
    } catch (error) {
      console.error('Shipment fetch error:', error);
      toast.error('Failed to load shipment');
    } finally {
      setIsLoading(false);
    }
  }, [orderId, merchant?.id, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!orderId) return;
    const channel = supabase
      .channel(`merchant-shipment-${orderId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_tracking', filter: `order_id=eq.${orderId}` }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, () => fetchData())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, fetchData]);

  const timeline = useMemo<TimelineEvent[]>(() => {
    if (!order) return [];
    const events: TimelineEvent[] = [
      {
        id: 'created',
        title: 'Order Placed',
        description: `Order ${order.public_order_id ?? `#${order.order_number}`} created`,
        date: order.created_at,
        tone: 'info',
        done: true,
      },
    ];
    if (tracking) {
      events.push({
        id: 'tracking',
        title: 'Shipment Added',
        description: `${tracking.courier_partner ?? 'Courier'} · ${tracking.tracking_number ?? 'No tracking number'}`,
        date: tracking.created_at,
        tone: 'info',
        done: true,
      });
      updates.forEach((u) => {
        const c = TRACK_STATUS[u.status ?? ''] ?? { label: u.status ?? 'Update', tone: 'neutral' as StatusTone };
        events.push({
          id: u.id,
          title: c.label,
          description: u.description ?? u.location ?? 'Shipment status update',
          date: u.created_at,
          tone: c.tone ?? 'neutral',
          done: true,
        });
      });
    }
    if (order.shipped_at || tracking?.shipment_date) {
      events.push({
        id: 'shipped',
        title: 'Dispatched',
        description: 'Package handed to courier',
        date: tracking?.shipment_date ?? order.shipped_at!,
        tone: 'info',
        done: true,
      });
    }
    if (order.delivered_at || tracking?.actual_delivery) {
      events.push({
        id: 'delivered',
        title: 'Delivered',
        description: 'Package delivered to customer',
        date: tracking?.actual_delivery ?? order.delivered_at!,
        tone: 'success',
        done: true,
      });
    }
    if (order.status === 'completed' && order.escrow_status === 'released') {
      events.push({
        id: 'release',
        title: 'Payment Released',
        description: 'Delivery confirmed — funds released to your wallet',
        date: order.created_at,
        tone: 'success',
        done: true,
      });
    }
    return events;
  }, [order, tracking, updates]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-5 pb-16 sm:px-6 sm:py-7">
        <Skeleton className="mb-4 h-9 w-56 rounded-lg" />
        <Skeleton className="mb-4 h-32 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="mb-4 text-muted-foreground">Shipment not found</p>
        <Button variant="outline" onClick={() => navigate('/merchant-shipments')}>
          Back to Shipments
        </Button>
      </div>
    );
  }

  const escrowTone: StatusTone = order.escrow_status === 'released' ? 'success' : order.escrow_status === 'held' ? 'warning' : 'neutral';
  const escrowLabel =
    order.escrow_status === 'released'
      ? 'Released'
      : order.escrow_status === 'held'
        ? 'Held in escrow'
        : order.escrow_status === 'refunded'
          ? 'Refunded'
          : order.escrow_status ?? '—';
  const trackConfig = tracking ? TRACK_STATUS[tracking.status ?? ''] ?? { tone: 'neutral' as StatusTone, label: tracking.status ?? 'Pending' } : null;
  const orderConfig = ORDER_STATUS[order.status] ?? { tone: 'neutral' as StatusTone, label: order.status };

  return (
    <>
      <div className="mx-auto max-w-3xl px-4 py-5 pb-16 sm:px-6 sm:py-7">
        <MerchantPageHeader
          title={order.public_order_id ?? `Shipment #${order.order_number}`}
          subtitle={tracking?.tracking_number ? `${tracking.courier_partner ?? 'Courier'} · ${tracking.tracking_number}` : 'No tracking added yet'}
          back={{ fallback: '/merchant-shipments', label: 'Back to Shipments' }}
          actions={
            tracking ? (
              <Link to={`/merchant-edit-tracking/${order.id}`}>
                <Button variant="outline" size="sm">
                  <Pencil className="h-4 w-4 mr-1.5" /> Edit
                </Button>
              </Link>
            ) : (
              <Link to={`/merchant-add-tracking/${order.id}`}>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1.5" /> Add Tracking
                </Button>
              </Link>
            )
          }
        />

        {/* Status cards */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <Card className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Order Status</p>
            <div className="mt-2">
              <StatusBadge tone={orderConfig.tone} label={orderConfig.label} dot />
            </div>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium text-muted-foreground">SafePay Funds</p>
            <div className="mt-2">
              <StatusBadge tone={escrowTone} label={escrowLabel} dot />
            </div>
          </Card>
        </div>

        {/* Tracking details */}
        <Card className="mb-4 p-4">
          <h2 className="mb-2 text-sm font-semibold text-foreground">Tracking</h2>
          {tracking ? (
            <div className="divide-y divide-border">
              <Row label="Tracking number" value={tracking.tracking_number ?? '—'} />
              <Row label="Courier partner" value={tracking.courier_partner ?? '—'} />
              <Row label="Status" value={trackConfig ? <StatusBadge tone={trackConfig.tone} label={trackConfig.label} dot className="text-[10px] px-1.5 py-0.5" /> : '—'} />
              {tracking.shipment_date && <Row label="Dispatched" value={new Date(tracking.shipment_date).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} />}
              {tracking.estimated_delivery && <Row label="Estimated delivery" value={new Date(tracking.estimated_delivery).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} />}
              {tracking.actual_delivery && <Row label="Actual delivery" value={new Date(tracking.actual_delivery).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} />}
              {tracking.notes && <Row label="Notes" value={tracking.notes} />}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No tracking added yet. Add tracking to keep the buyer informed and unlock faster fund release.
            </p>
          )}
        </Card>

        {/* Timeline */}
        <Card className="mb-4 p-4">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Shipment Timeline</h2>
          {timeline.length <= 1 ? (
            <p className="text-sm text-muted-foreground">Shipment events will appear here as the package moves.</p>
          ) : (
            <div className="space-y-0">
              {timeline.map((event, index) => (
                <div key={event.id} className="relative flex gap-3 pb-4">
                  {index < timeline.length - 1 && <div className="absolute left-[15px] top-8 bottom-0 w-0.5 bg-border" />}
                  <TimelineIcon tone={event.tone} done={event.done} />
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-sm font-medium text-foreground">{event.title}</p>
                    <p className="text-xs text-muted-foreground">{event.description}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {new Date(event.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Products */}
        {products.length > 0 && (
          <Card className="mb-4 p-4">
            <h2 className="mb-3 text-sm font-semibold text-foreground">Products in this shipment</h2>
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

        {/* Financial linkage */}
        <Card className="mb-4 p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Wallet className="h-4 w-4 text-muted-foreground" /> Payment & Release
          </h2>
          <div className="divide-y divide-border">
            <Row label="Order amount" value={formatAmount(order.amount, order.currency)} />
            <Row label="SafePay status" value={<StatusBadge tone={escrowTone} label={escrowLabel} dot className="text-[10px] px-1.5 py-0.5" />} />
            <Row
              label="Payment release"
              value={
                order.status === 'completed' && order.escrow_status === 'released' ? (
                  <span className="flex items-center gap-1.5 text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Released
                  </span>
                ) : order.status === 'disputed' ? (
                  <span className="flex items-center gap-1.5 text-destructive">
                    <Gavel className="h-3.5 w-3.5" /> On hold — dispute
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    {order.status === 'refunded' || order.status === 'cancelled' ? 'Refunded' : 'Held until delivery confirmed'}
                  </span>
                )
              }
            />
            {dispute && (
              <div className="flex items-center justify-between gap-3 py-1.5">
                <span className="shrink-0 text-xs text-muted-foreground">Dispute</span>
                <Link to={`/merchant-dispute-response/${dispute.id}`} className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                  <Gavel className="h-3.5 w-3.5" />
                  {dispute.public_dispute_id ?? 'View dispute'} →
                </Link>
              </div>
            )}
          </div>
        </Card>

        {/* Linked records */}
        <div className="space-y-2">
          <Link to={`/merchant-order/${order.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 transition-all hover:border-primary/30 active:scale-[0.99]">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
              <ShoppingCart className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">View Order</p>
              <p className="truncate text-[11px] text-muted-foreground">{order.product_name}</p>
            </div>
          </Link>
          {tx && (
            <Link to={`/merchant-transactions/${tx.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 transition-all hover:border-primary/30 active:scale-[0.99]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                <Wallet className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{tx.public_payment_id ?? 'Payment Transaction'}</p>
                <p className="truncate text-[11px] text-muted-foreground">{formatAmount(tx.amount, tx.currency)} · {tx.status}</p>
              </div>
            </Link>
          )}
          {refunds.length > 0 &&
            refunds.map((r) => (
              <Link key={r.id} to={`/merchant-refunds/${r.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 transition-all hover:border-primary/30 active:scale-[0.99]">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                  <RotateCcw className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{r.public_refund_id ?? 'Refund'}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{formatAmount(r.amount, r.currency)} · {r.reason ?? 'Order refund'}</p>
                </div>
              </Link>
            ))}
        </div>

        {order.status === 'pending' && !tracking && (
          <Card className="mt-4 flex items-center gap-3 border-warning/30 bg-warning/[0.06] p-4">
            <Plane className="h-5 w-5 shrink-0 text-warning" />
            <p className="text-sm text-foreground">Add tracking to speed up delivery confirmation and fund release.</p>
          </Card>
        )}
      </div>
      <MerchantBottomNav />
    </>
  );
}
