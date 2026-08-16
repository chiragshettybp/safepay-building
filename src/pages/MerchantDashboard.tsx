import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock,
  Gavel,
  Inbox,
  Landmark,
  Link2,
  Lock,
  Package,
  PartyPopper,
  Plus,
  RefreshCw,
  ShieldCheck,
  Store,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { useMerchantProfile } from '@/components/merchant/MerchantProfileContext';
import { useMerchantDashboard, type MerchantOrderRow, type MerchantTransactionRow } from '@/hooks/useMerchantDashboard';
import { supabase } from '@/integrations/supabase/client';
import { formatAmount } from '@/lib/format';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge, type StatusTone } from '@/components/shared/StatusBadge';
import { MerchantBottomNav } from '@/components/shared/MerchantBottomNav';
import { cn } from '@/lib/utils';

const ORDER_STATUS: Record<string, { tone: StatusTone; label: string }> = {
  pending: { tone: 'neutral', label: 'Pending' },
  awaiting_shipment: { tone: 'neutral', label: 'Awaiting Shipment' },
  shipped: { tone: 'info', label: 'Shipped' },
  in_progress: { tone: 'info', label: 'In Transit' },
  delivered: { tone: 'success', label: 'Delivered' },
  completed: { tone: 'success', label: 'Completed' },
  disputed: { tone: 'destructive', label: 'Disputed' },
  refunded: { tone: 'warning', label: 'Refunded' },
  cancelled: { tone: 'neutral', label: 'Cancelled' },
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function SectionHeader({ title, action }: { title: string; action?: { label: string; to: string } }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {action && (
        <Link to={action.to} className="flex items-center gap-0.5 text-xs font-medium text-primary hover:underline">
          {action.label}
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

function SkeletonBlocks({ count = 3, className = 'h-20' }: { count?: number; className?: string }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={cn('w-full rounded-2xl', className)} />
      ))}
    </div>
  );
}

function DashboardError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 border-destructive/30 bg-destructive/5 p-8 text-center">
      <AlertCircle className="h-8 w-8 text-destructive" />
      <p className="text-sm font-medium text-foreground">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="h-4 w-4 mr-2" /> Try Again
      </Button>
    </Card>
  );
}

function MoneyBlock({ label, value, hint, icon: Icon, highlight }: { label: string; value: string; hint?: string; icon: React.ComponentType<{ className?: string }>; highlight?: boolean }) {
  return (
    <div className={cn('rounded-2xl border p-4', highlight ? 'border-primary/30 bg-primary/[0.06]' : 'border-border bg-card')}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <p className="text-xs font-medium">{label}</p>
      </div>
      <p className={cn('mt-2 text-2xl font-bold tracking-tight', highlight ? 'text-foreground' : 'text-foreground')}>{value}</p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">{hint}</p>}
    </div>
  );
}

function StatCard({ label, value, context, icon: Icon, to, tone }: { label: string; value: number; context: string; icon: React.ComponentType<{ className?: string }>; to: string; tone?: 'destructive' | 'warning' | 'info' }) {
  return (
    <Link
      to={to}
      className={cn(
        'group flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 transition-all active:scale-[0.98] hover:border-primary/30',
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          tone === 'destructive' ? 'bg-destructive/10 text-destructive' : tone === 'warning' ? 'bg-warning/10 text-warning' : tone === 'info' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-bold leading-tight text-foreground">{value}</p>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground/80">{context}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function OrderRow({ order, currency }: { order: MerchantOrderRow; currency: string }) {
  const config = ORDER_STATUS[order.status] ?? { tone: 'neutral' as StatusTone, label: order.status };
  return (
    <Link
      to={`/merchant-order/${order.id}`}
      className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/30 active:bg-muted/40"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
        <Package className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground font-mono">{order.public_order_id ?? `#${order.order_number}`}</p>
        <p className="truncate text-xs text-muted-foreground">{order.product_name}</p>
      </div>
      <div className="hidden sm:block">
        <StatusBadge tone={config.tone} label={config.label} dot className="text-[10px] px-1.5 py-0.5" />
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-foreground">{formatAmount(order.amount, currency)}</p>
        <p className="text-[10px] text-muted-foreground">
          {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </p>
      </div>
    </Link>
  );
}

function TransactionRow({ tx }: { tx: MerchantTransactionRow }) {
  const credit = tx.amount > 0;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          credit ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground',
        )}
      >
        {credit ? <ArrowDownRight className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{tx.label}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {tx.reference} · {new Date(tx.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
        </p>
      </div>
      <p className={cn('shrink-0 text-sm font-bold', credit ? 'text-success' : 'text-foreground')}>
        {formatAmount(tx.amount, tx.currency)}
      </p>
    </div>
  );
}

function RevenueChart({ days, onChange, series }: { days: 7 | 30 | 90; onChange: (d: 7 | 30 | 90) => void; series: { date: string; amount: number }[] }) {
  const total = series.reduce((s, p) => s + p.amount, 0);
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Revenue</h2>
          <p className="text-lg font-bold text-foreground">{formatAmount(total)}</p>
        </div>
        <div className="flex rounded-lg border border-border p-0.5">
          {([7, 30, 90] as const).map((d) => (
            <button
              key={d}
              onClick={() => onChange(d)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                days === d ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {d}D
            </button>
          ))}
        </div>
      </div>
      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
            <defs>
              <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              tickFormatter={(v: string) => new Date(v + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              tickLine={false}
              axisLine={false}
              minTickGap={28}
            />
            <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} width={44} />
            <Tooltip
              cursor={{ stroke: 'var(--border)' }}
              contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }}
              labelFormatter={(v) => new Date(String(v) + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
              formatter={(v) => [formatAmount(Number(v)), 'Revenue']}
            />
            <Area type="monotone" dataKey="amount" stroke="var(--primary)" strokeWidth={2} fill="url(#revenueFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function subscribeDashboardRealtime(merchantId: string, refresh: () => void) {
  const orders = supabase
    .channel('merchant-dash-orders')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `merchant_id=eq.${merchantId}` }, refresh)
    .subscribe();
  const activity = supabase
    .channel('merchant-dash-activity')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'merchant_activity', filter: `merchant_id=eq.${merchantId}` }, refresh)
    .subscribe();
  return { orders, activity };
}

export default function MerchantDashboard() {
  const { user } = useMerchantAuth();
  const profile = useMerchantProfile();
  const navigate = useNavigate();
  const { loading, error, wallet, orders, disputes, transactions, activities, stats, pipeline, revenue, refresh } = useMerchantDashboard(profile?.id ?? '');

  const [revenueDays, setRevenueDays] = useState<7 | 30 | 90>(30);
  const currency = wallet?.currency ?? 'INR';

  const firstName = (profile?.business_name ?? user?.fullName ?? 'Merchant').split(' ')[0];

  const attentionCount = useMemo(() => {
    const disputesAttention = disputes.filter((d) => d.merchant_not_responded || d.status === 'open' || d.status === 'info_required').length;
    return stats.toShip + disputesAttention + (wallet && wallet.balance > 0 ? 1 : 0);
  }, [disputes, stats.toShip, wallet]);

  const actionCards = useMemo(() => {
    const cards: { key: string; icon: React.ComponentType<{ className?: string }>; title: string; desc: string; to: string; tone: 'destructive' | 'warning' | 'info' }[] = [];
    const disputesAttention = disputes.filter((d) => d.merchant_not_responded || d.status === 'open' || d.status === 'info_required');
    if (disputesAttention.length > 0) {
      const n = disputesAttention.length;
      cards.push({
        key: 'dispute',
        icon: Gavel,
        title: `${n} dispute${n > 1 ? 's' : ''} need${n === 1 ? 's' : ''} your response`,
        desc: 'Respond before the review deadline to protect your funds.',
        to: '/merchant-disputes',
        tone: 'destructive',
      });
    }
    if (stats.toShip > 0) {
      cards.push({
        key: 'ship',
        icon: Truck,
        title: `${stats.toShip} order${stats.toShip > 1 ? 's' : ''} need${stats.toShip === 1 ? 's' : ''} shipping`,
        desc: 'Add tracking details to keep deliveries on schedule.',
        to: '/merchant-orders',
        tone: 'warning',
      });
    }
    if (wallet && wallet.balance > 0) {
      cards.push({
        key: 'withdraw',
        icon: Landmark,
        title: `${formatAmount(wallet.balance, currency)} available to withdraw`,
        desc: 'Move available funds to your bank account.',
        to: '/merchant-withdraw',
        tone: 'info',
      });
    }
    return cards;
  }, [disputes, stats.toShip, wallet, currency]);

  const delayedShipments = useMemo(() => {
    const now = Date.now();
    return orders.filter((o) => {
      if (!o.expected_delivery) return false;
      if (o.status === 'delivered' || o.status === 'completed' || o.status === 'cancelled' || o.status === 'refunded') return false;
      return new Date(o.expected_delivery).getTime() < now;
    }).length;
  }, [orders]);

  const recentOrders = orders.slice(0, 5);
  const recentTransactions = transactions.slice(0, 6);
  const topActivity = activities.slice(0, 4);

  useEffect(() => {
    if (!profile?.id) return;
    const channel = subscribeDashboardRealtime(profile.id, refresh);
    return () => {
      supabase.removeChannel(channel.orders);
      supabase.removeChannel(channel.activity);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, refresh]);

  return (
    <>
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-5 pb-16 sm:px-6 sm:py-7">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          {greeting()}, {firstName} 👋
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {attentionCount > 0 ? (
            <>{attentionCount} item{attentionCount > 1 ? 's' : ''} need your attention today.</>
          ) : (
            <>Your business is running smoothly.</>
          )}
        </p>
      </div>

      {error && (
        <DashboardError message={error} onRetry={refresh} />
      )}

      {/* Action Required */}
      <section aria-label="Action required">
        <SectionHeader title="Action Required" />
        {loading ? (
          <SkeletonBlocks count={2} className="h-20" />
        ) : actionCards.length > 0 ? (
          <div className="space-y-2">
            {actionCards.map((card) => (
              <Link
                key={card.key}
                to={card.to}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border p-3.5 transition-all active:scale-[0.99]',
                  card.tone === 'destructive'
                    ? 'border-destructive/30 bg-destructive/[0.06]'
                    : card.tone === 'warning'
                      ? 'border-warning/40 bg-warning/[0.07]'
                      : 'border-primary/30 bg-primary/[0.06]',
                )}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                    card.tone === 'destructive' ? 'bg-destructive/10 text-destructive' : card.tone === 'warning' ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary',
                  )}
                >
                  <card.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{card.title}</p>
                  <p className="text-xs text-muted-foreground">{card.desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
              </Link>
            ))}
          </div>
        ) : (
          <Card className="flex items-center gap-3 border-border bg-card p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
              <PartyPopper className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">You're all caught up</p>
              <p className="text-xs text-muted-foreground">No merchant action is required right now.</p>
            </div>
          </Card>
        )}
      </section>

      {/* Your Money */}
      <section aria-label="Your money">
        <SectionHeader title="Your Money" />
        {loading ? (
          <SkeletonBlocks count={2} className="h-24" />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-primary/30 bg-primary/[0.06] p-4 sm:col-span-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Wallet className="h-4 w-4" />
                <p className="text-xs font-medium">Available to Withdraw</p>
              </div>
              <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
                <p className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {formatAmount(wallet?.balance ?? 0, currency)}
                </p>
                {wallet && wallet.balance > 0 ? (
                  <Button size="sm" className="h-9" onClick={() => navigate('/merchant-withdraw')}>
                    <Landmark className="h-4 w-4 mr-1.5" /> Withdraw
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="h-9" disabled>
                    Nothing to withdraw
                  </Button>
                )}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Money you can move to your bank right now.</p>
            </div>
            <MoneyBlock
              label="Protected in SafePay"
              value={formatAmount(stats.heldFunds, currency)}
              hint="Held until buyers confirm delivery."
              icon={ShieldCheck}
            />
            <MoneyBlock
              label="Pending Release"
              value={formatAmount(wallet?.pending_balance ?? 0, currency)}
              hint="Awaiting release to your balance."
              icon={Lock}
            />
            <MoneyBlock
              label="Total Earned"
              value={formatAmount(wallet?.total_earned ?? 0, currency)}
              hint="Lifetime completed earnings."
              icon={BarChart3}
            />
            <MoneyBlock
              label="Total Withdrawn"
              value={formatAmount(wallet?.total_withdrawn ?? 0, currency)}
              hint="Cumulative payouts to your bank."
              icon={Landmark}
            />
          </div>
        )}
      </section>

      {/* Order stats */}
      <section aria-label="Order summary">
        <SectionHeader title="Orders" action={{ label: 'View all', to: '/merchant-orders' }} />
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard icon={Package} label="Total Orders" value={stats.totalOrders} context={stats.completed > 0 ? `${stats.completed} completed` : 'No orders yet'} to="/merchant-orders" />
            <StatCard icon={Clock} label="Pending" value={stats.pending} context="Awaiting action" to="/merchant-orders" tone="warning" />
            <StatCard icon={Truck} label="In Transit" value={stats.inTransit} context="Currently shipping" to="/merchant-orders?status=in_transit" tone="info" />
            <StatCard icon={Gavel} label="Disputes" value={stats.disputed} context="Requires attention" to="/merchant-disputes" tone={stats.disputed > 0 ? 'destructive' : undefined} />
          </div>
        )}
      </section>

      {/* Pipeline */}
      {!loading && stats.totalOrders > 0 && (
        <section aria-label="Order pipeline" className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Order Pipeline</h2>
          <div className="grid grid-cols-4 gap-2">
            {pipeline.map((stage, i) => (
              <div key={stage.key} className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-[11px] font-medium text-muted-foreground">{stage.label}</p>
                  <p className="ml-auto text-sm font-bold text-foreground">{stage.count}</p>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      i === pipeline.length - 1 ? 'bg-success' : 'bg-primary',
                    )}
                    style={{ width: `${stats.totalOrders > 0 ? (stage.count / stats.totalOrders) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent orders */}
      <section aria-label="Recent orders">
        <SectionHeader title="Recent Orders" action={{ label: 'View all', to: '/merchant-orders' }} />
        {loading ? (
          <SkeletonBlocks count={4} className="h-16" />
        ) : recentOrders.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No orders yet"
            description="When a buyer completes a SafePay transaction, it will appear here."
            action={
              <Button onClick={() => navigate('/payment-links/create')}>
                <Plus className="h-4 w-4 mr-1.5" /> Create Payment Link
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {recentOrders.map((o) => (
              <OrderRow key={o.id} order={o} currency={currency} />
            ))}
          </div>
        )}
      </section>

      {/* Revenue + Shipments */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {loading ? (
            <Skeleton className="h-64 w-full rounded-2xl" />
          ) : (
            <RevenueChart days={revenueDays} onChange={setRevenueDays} series={revenue.slice(-revenueDays)} />
          )}
        </div>
        <div className="lg:col-span-2">
          <Card className="flex h-full flex-col p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Shipping</h2>
              <Link to="/merchant-shipments" className="text-xs font-medium text-primary hover:underline">View</Link>
            </div>
            {loading ? (
              <SkeletonBlocks count={4} className="h-9" />
            ) : (
              <div className="flex flex-1 flex-col justify-center gap-2.5">
                {[
                  { label: 'To Ship', value: stats.toShip, icon: Truck },
                  { label: 'Shipped', value: stats.inTransit, icon: Package },
                  { label: 'Delivered', value: stats.delivered, icon: CheckCircle2 },
                  { label: 'Delayed', value: delayedShipments, icon: AlertCircle },
                ].map((row) => (
                  <Link
                    key={row.label}
                    to="/merchant-shipments"
                    className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/30"
                  >
                    <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <row.icon className={cn('h-4 w-4', row.label === 'Delayed' && delayedShipments > 0 ? 'text-destructive' : 'text-primary')} />
                      {row.label}
                    </span>
                    <span className="text-sm font-bold text-foreground">{row.value}</span>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Recent transactions */}
      <section aria-label="Recent transactions">
        <SectionHeader title="Recent Transactions" action={{ label: 'View all', to: '/merchant-transactions' }} />
        {loading ? (
          <SkeletonBlocks count={3} className="h-16" />
        ) : recentTransactions.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No transactions yet"
            description="Payments, refunds and payouts will appear here as they happen."
          />
        ) : (
          <div className="space-y-2">
            {recentTransactions.map((tx) => (
              <TransactionRow key={`${tx.type}-${tx.id}`} tx={tx} />
            ))}
          </div>
        )}
      </section>

      {/* Disputes */}
      <section aria-label="Disputes overview">
        <SectionHeader title="Disputes" action={{ label: 'View all', to: '/merchant-disputes' }} />
        {loading ? (
          <Skeleton className="h-24 w-full rounded-2xl" />
        ) : disputes.length === 0 ? (
          <Card className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">No active disputes</p>
              <p className="text-xs text-muted-foreground">Your transactions are currently clear.</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-2">
            {disputes.slice(0, 3).map((d) => {
              const order = orders.find((o) => o.id === d.order_id);
              const needsResponse = d.merchant_not_responded || d.status === 'open' || d.status === 'info_required';
              return (
                <Link
                  key={d.id}
                  to={needsResponse ? `/merchant-dispute-response/${d.id}` : `/merchant-dispute-result/${d.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-destructive/25 bg-destructive/[0.04] p-3.5 transition-all active:scale-[0.99]"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                    <Gavel className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{order?.product_name ?? 'Disputed order'}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatAmount(order?.amount ?? 0, currency)} · {d.reason}
                    </p>
                  </div>
                  {needsResponse ? (
                    <Button size="sm" variant="destructive" className="h-8">
                      Respond
                    </Button>
                  ) : (
                    <StatusBadge tone="neutral" label={d.status} className="text-[10px] px-1.5 py-0.5" />
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Quick actions */}
      {!loading && (
        <section aria-label="Quick actions">
          <SectionHeader title="Quick Actions" />
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: 'Payment Link', icon: Link2, to: '/payment-links/create' },
              { label: 'View Orders', icon: Package, to: '/merchant-orders' },
              { label: 'Withdraw', icon: Landmark, to: '/merchant-withdraw' },
              { label: 'Transactions', icon: Wallet, to: '/merchant-transactions' },
              { label: 'Customers', icon: Users, to: '/merchant-customers' },
              { label: 'Analytics', icon: BarChart3, to: '/merchant-analytics' },
            ].map((a) => (
              <Link
                key={a.label}
                to={a.to}
                className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card p-3 text-center transition-all hover:border-primary/30 active:scale-[0.98]"
              >
                <a.icon className="h-5 w-5 text-primary" />
                <span className="text-[11px] font-medium text-foreground">{a.label}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent activity */}
      {!loading && topActivity.length > 0 && (
        <section aria-label="Recent activity">
          <SectionHeader title="Recent Activity" />
          <div className="space-y-2">
            {topActivity.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  {a.activity_type === 'tracking' ? (
                    <Truck className="h-4 w-4 text-primary" />
                  ) : a.activity_type === 'delivery' ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : (
                    <Store className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{a.title}</p>
                  {a.description && <p className="truncate text-xs text-muted-foreground">{a.description}</p>}
                </div>
                <p className="shrink-0 text-[11px] text-muted-foreground">
                  {new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
    <MerchantBottomNav />
    </>
  );
}
