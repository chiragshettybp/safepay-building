import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, ChevronRight, Package, Plus, RefreshCw, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MerchantPageHeader } from '@/components/merchant/MerchantPageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge, type StatusTone } from '@/components/shared/StatusBadge';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { useMerchantOrders } from '@/hooks/useMerchantOrders';
import { MerchantBottomNav } from '@/components/shared/MerchantBottomNav';
import { formatAmount } from '@/lib/format';
import { cn } from '@/lib/utils';

const SHIP_TABS = [
  { key: 'to_ship', label: 'To Ship' },
  { key: 'in_transit', label: 'In Transit' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'delayed', label: 'Delayed' },
] as const;

type ShipTab = (typeof SHIP_TABS)[number]['key'];

const STATUS_TONE: Record<string, { tone: StatusTone; label: string }> = {
  pending: { tone: 'neutral', label: 'Pending' },
  awaiting_shipment: { tone: 'neutral', label: 'Awaiting Shipment' },
  shipped: { tone: 'info', label: 'Shipped' },
  in_progress: { tone: 'info', label: 'In Transit' },
  delivered: { tone: 'success', label: 'Delivered' },
  completed: { tone: 'success', label: 'Completed' },
};

export default function MerchantShipments() {
  const { merchant } = useMerchantAuth();
  const { loading, error, orders, refresh } = useMerchantOrders(merchant?.id ?? '');
  const [tab, setTab] = useState<ShipTab>('to_ship');

  const groups = useMemo(() => {
    const now = Date.now();
    const toShip = orders.filter((o) => o.status === 'pending' || o.status === 'awaiting_shipment');
    const inTransit = orders.filter((o) => o.status === 'shipped' || o.status === 'in_progress');
    const delivered = orders.filter((o) => o.status === 'delivered' || o.status === 'completed');
    const delayed = orders.filter((o) => {
      if (!o.expected_delivery) return false;
      if (o.status === 'delivered' || o.status === 'completed' || o.status === 'cancelled' || o.status === 'refunded') return false;
      return new Date(o.expected_delivery).getTime() < now;
    });
    return { toShip, inTransit, delivered, delayed };
  }, [orders]);

  const tabCounts: Record<ShipTab, number> = {
    to_ship: groups.toShip.length,
    in_transit: groups.inTransit.length,
    delivered: groups.delivered.length,
    delayed: groups.delayed.length,
  };

  const visible =
    tab === 'to_ship' ? groups.toShip : tab === 'in_transit' ? groups.inTransit : tab === 'delivered' ? groups.delivered : groups.delayed;

  const canAddTracking = (o: (typeof visible)[number]) =>
    !o.tracking_number && (o.status === 'pending' || o.status === 'awaiting_shipment' || o.status === 'shipped' || o.status === 'in_progress');

  return (
    <>
    <div className="mx-auto max-w-5xl px-4 py-5 pb-16 sm:px-6 sm:py-7">
      <MerchantPageHeader
        title="Shipments"
        subtitle="Track, ship and deliver your orders on time."
        actions={
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-1.5', loading && 'animate-spin')} /> Refresh
          </Button>
        }
      />

      {error && (
        <Card className="mb-4 flex items-center justify-between gap-3 border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={refresh}>
            Try Again
          </Button>
        </Card>
      )}

      <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg border border-border p-0.5 w-fit">
        {SHIP_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
              tab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
            <span
              className={cn(
                'rounded-full px-1.5 text-[10px] font-bold',
                tab === t.key ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground',
                t.key === 'delayed' && groups.delayed.length > 0 && tab !== 'delayed' && 'bg-destructive/15 text-destructive',
              )}
            >
              {tabCounts[t.key]}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Package}
          title={
            tab === 'to_ship'
              ? 'Nothing to ship'
              : tab === 'in_transit'
                ? 'Nothing in transit'
                : tab === 'delivered'
                  ? 'No delivered orders'
                  : 'No delayed orders'
          }
          description={
            tab === 'to_ship'
              ? 'When an order is pending shipment it will show up here.'
              : 'Orders in this state will appear here automatically.'
          }
        />
      ) : (
        <div className="space-y-2">
          {visible.map((o) => {
            const config = STATUS_TONE[o.status] ?? { tone: 'neutral' as StatusTone, label: o.status };
            return (
              <Link
                key={o.id}
                to={`/merchant-shipments/${o.id}`}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3.5 transition-all hover:border-primary/30 active:scale-[0.99] sm:flex-row sm:items-center"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                    <Package className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground font-mono">{o.public_order_id ?? `#${o.order_number}`}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {o.product_name} · {formatAmount(o.amount, o.currency)}
                    </p>
                    {o.tracking_number ? (
                      <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                        <Truck className="h-3 w-3 shrink-0 text-primary" />
                        {o.carrier ? `${o.carrier} · ` : ''}
                        {o.tracking_number}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-[11px] text-warning">No tracking added yet</p>
                    )}
                  </div>
                </div>
                {o.expected_delivery && (
                  <p
                    className={cn(
                      'shrink-0 text-[11px] text-muted-foreground',
                      tab === 'delayed' && 'text-destructive font-medium',
                    )}
                  >
                    Expected {new Date(o.expected_delivery).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </p>
                )}
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge tone={config.tone} label={config.label} dot className="text-[10px] px-1.5 py-0.5" />
                  {canAddTracking(o) ? (
                    <Link to={`/merchant-add-tracking/${o.id}`}>
                      <Button size="sm" className="h-8">
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add Tracking
                      </Button>
                    </Link>
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {!loading && groups.delayed.length > 0 && tab !== 'delayed' && (
        <Card className="mt-4 flex items-center gap-3 border-warning/30 bg-warning/[0.06] p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-warning" />
          <p className="text-sm text-foreground">
            {groups.delayed.length} order{groups.delayed.length > 1 ? 's' : ''} past the expected delivery date. Follow up to keep buyers confident.
          </p>
          <button onClick={() => setTab('delayed')} className="ml-auto shrink-0 text-xs font-medium text-primary hover:underline">
            View
          </button>
        </Card>
      )}
    </div>
      <MerchantBottomNav />
    </>
  );
}
