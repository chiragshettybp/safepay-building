import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Gavel,
  Package,
  PackageSearch,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  TrendingUp,
  Truck,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MerchantPageHeader } from '@/components/merchant/MerchantPageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge, type StatusTone } from '@/components/shared/StatusBadge';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { useMerchantOrders } from '@/hooks/useMerchantOrders';
import { useMerchantProducts } from '@/hooks/useMerchantProducts';
import { supabase } from '@/integrations/supabase/client';
import { MerchantBottomNav } from '@/components/shared/MerchantBottomNav';
import { toast } from 'sonner';
import { formatAmount } from '@/lib/format';
import { cn } from '@/lib/utils';

const PIE_COLORS = ['hsl(var(--primary))', 'hsl(var(--info))', 'hsl(var(--warning))', 'hsl(var(--success))', 'hsl(var(--destructive))', 'hsl(var(--muted-foreground))'];

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'refunds', label: 'Refunds' },
  { key: 'disputes', label: 'Disputes' },
  { key: 'shipments', label: 'Shipments' },
  { key: 'products', label: 'Products' },
] as const;

type Tab = (typeof TABS)[number]['key'];

interface RefundRow {
  id: string;
  order_id: string;
  amount: number;
  currency: string | null;
  status: string;
  reason: string | null;
  created_at: string;
  orders: { public_order_id: string | null; order_number: string; product_name: string } | null;
}

interface DisputeRow {
  id: string;
  order_id: string;
  status: string;
  reason: string | null;
  created_at: string;
  orders: { public_order_id: string | null; order_number: string; product_name: string } | null;
}

interface ItemRow {
  product_id: string;
  quantity: number;
  line_total: number;
  order_id: string;
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  to,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  to?: string;
}) {
  const body = (
    <Card className="group h-full p-4 transition-all hover:border-primary/40">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <p className="text-xs font-medium">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
      {to && <ArrowRight className="absolute right-3 top-3 h-3.5 w-3.5 text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100" />}
    </Card>
  );
  if (to) {
    return (
      <Link to={to} className="relative block">
        {body}
      </Link>
    );
  }
  return body;
}

function MiniStat({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'success' | 'destructive' | 'warning' | 'info' }) {
  const color =
    tone === 'success'
      ? 'text-success'
      : tone === 'destructive'
        ? 'text-destructive'
        : tone === 'warning'
          ? 'text-warning'
          : tone === 'info'
            ? 'text-info'
            : 'text-foreground';
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn('mt-0.5 text-lg font-bold tabular-nums', color)}>{value}</p>
    </div>
  );
}

export default function MerchantAnalytics() {
  const { merchant } = useMerchantAuth();
  const { loading: ordersLoading, error: ordersError, orders, refresh: refreshOrders } = useMerchantOrders(merchant?.id ?? '');
  const { products, refresh: refreshProducts } = useMerchantProducts(merchant?.id ?? '');
  const [tab, setTab] = useState<Tab>('overview');
  const [days, setDays] = useState<7 | 30 | 90>(30);

  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [auxLoading, setAuxLoading] = useState(true);

  const fetchAux = useCallback(async () => {
    if (!merchant?.id) return;
    setAuxLoading(true);
    try {
      const { data: orderData } = await supabase
        .from('orders')
        .select('id, public_order_id, order_number, product_name')
        .eq('merchant_id', merchant.id);
      const orderIds = (orderData ?? []).map((o) => o.id);
      const orderMap = new Map((orderData ?? []).map((o) => [o.id, o]));

      const [refundsRes, disputesRes, itemsRes] = await Promise.all([
        orderIds.length > 0
          ? supabase
              .from('refunds')
              .select('id, order_id, amount, currency, status, reason, created_at')
              .in('order_id', orderIds)
              .order('created_at', { ascending: false })
              .limit(200)
          : Promise.resolve({ data: [], error: null }),
        orderIds.length > 0
          ? supabase
              .from('disputes')
              .select('id, order_id, status, reason, created_at')
              .in('order_id', orderIds)
              .order('created_at', { ascending: false })
              .limit(200)
          : Promise.resolve({ data: [], error: null }),
        orderIds.length > 0
          ? supabase.from('order_items').select('product_id, quantity, line_total, order_id').in('order_id', orderIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      setRefunds(
        ((refundsRes.data ?? []) as any[]).map((r) => {
          const o = orderMap.get(r.order_id);
          return { ...r, orders: o ? { public_order_id: o.public_order_id, order_number: o.order_number, product_name: o.product_name } : null };
        }) as RefundRow[],
      );
      setDisputes(
        ((disputesRes.data ?? []) as any[]).map((d) => {
          const o = orderMap.get(d.order_id);
          return { ...d, orders: o ? { public_order_id: o.public_order_id, order_number: o.order_number, product_name: o.product_name } : null };
        }) as DisputeRow[],
      );
      setItems((itemsRes.data ?? []) as ItemRow[]);
    } catch (error) {
      console.error('Analytics aux fetch error:', error);
      toast.error('Some analytics failed to load');
    } finally {
      setAuxLoading(false);
    }
  }, [merchant?.id]);

  useEffect(() => {
    fetchAux();
  }, [fetchAux]);

  useEffect(() => {
    if (!merchant?.id) return;
    const channel = supabase
      .channel(`merchant-analytics-${merchant.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'refunds' }, fetchAux)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'disputes' }, fetchAux)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [merchant?.id, fetchAux]);

  const loading = ordersLoading || auxLoading;
  const error = ordersError;

  const within = (date: string, nDays: number) => new Date(date).getTime() >= Date.now() - nDays * 864e5;

  const revenueOf = (list: typeof orders) => list.filter((o) => o.escrow_status === 'released').reduce((s, o) => s + Number(o.amount), 0);

  const overview = useMemo(() => {
    const last30 = orders.filter((o) => within(o.created_at, 30));
    const revenue30 = revenueOf(last30);
    const refunded = orders.filter((o) => o.status === 'refunded').length;
    const disputed = orders.filter((o) => o.status === 'disputed').length;
    return {
      revenue30,
      orderCount30: last30.length,
      avgOrder: last30.length > 0 ? revenue30 / last30.length : 0,
      refundRate: orders.length > 0 ? (refunded / orders.length) * 100 : 0,
      disputeRate: orders.length > 0 ? (disputed / orders.length) * 100 : 0,
      refunded,
      disputed,
      totalOrders: orders.length,
      totalRevenue: revenueOf(orders),
    };
  }, [orders]);

  const revenueSeries = useMemo(() => {
    const now = new Date();
    const bucket = new Map<string, number>();
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      bucket.set(d.toISOString().slice(0, 10), 0);
    }
    orders.forEach((o) => {
      if (o.escrow_status !== 'released') return;
      const day = new Date(o.created_at).toISOString().slice(0, 10);
      if (bucket.has(day)) bucket.set(day, (bucket.get(day) ?? 0) + Number(o.amount));
    });
    return [...bucket.entries()].map(([date, amount]) => ({ date, amount }));
  }, [orders, days]);

  const monthly = useMemo(() => {
    const bucket = new Map<string, number>();
    orders.forEach((o) => {
      if (o.escrow_status !== 'released') return;
      const key = o.created_at.slice(0, 7);
      bucket.set(key, (bucket.get(key) ?? 0) + Number(o.amount));
    });
    return [...bucket.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([key, amount]) => ({ month: new Date(key + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'short' }), amount }));
  }, [orders]);

  const statusBreakdown = useMemo(() => {
    const count: Record<string, number> = {};
    orders.forEach((o) => {
      count[o.status] = (count[o.status] ?? 0) + 1;
    });
    return Object.entries(count)
      .map(([status, value]) => ({ status: status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [orders]);

  const topProducts = useMemo(() => {
    const map = new Map<string, number>();
    orders.forEach((o) => {
      if (o.escrow_status !== 'released') return;
      const name = o.product_name || 'Unnamed product';
      map.set(name, (map.get(name) ?? 0) + Number(o.amount));
    });
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, amount], i) => ({ name, amount, rank: i + 1 }));
  }, [orders]);

  const refundStats = useMemo(() => {
    const success = refunds.filter((r) => r.status === 'success');
    const inProgress = refunds.filter((r) => r.status === 'initiated' || r.status === 'processing');
    const failed = refunds.filter((r) => r.status === 'failed');
    return {
      total: refunds.length,
      success,
      inProgress,
      failed,
      amount: success.reduce((s, r) => s + Number(r.amount), 0),
      byReason: Object.entries(
        success.reduce<Record<string, number>>((acc, r) => {
          const k = r.reason?.replace(/_/g, ' ') || 'Other';
          acc[k] = (acc[k] ?? 0) + 1;
          return acc;
        }, {}),
      ).sort((a, b) => b[1] - a[1]),
      refundRate: orders.length > 0 ? (success.length / orders.length) * 100 : 0,
    };
  }, [refunds, orders]);

  const disputeStats = useMemo(() => {
    const open = disputes.filter((d) => d.status === 'under_review' || d.status === 'escalated');
    const closed = disputes.filter((d) => d.status === 'closed');
    const openOrderIds = new Set(open.map((d) => d.order_id));
    const protectedAmount = orders
      .filter((o) => openOrderIds.has(o.id) || o.escrow_status === 'held')
      .reduce((s, o) => s + Number(o.amount), 0);
    return { total: disputes.length, open, closed, protectedAmount, byReason: Object.entries(
      disputes.reduce<Record<string, number>>((acc, d) => {
        const k = d.reason?.replace(/_/g, ' ') || 'Other';
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {}),
    ).sort((a, b) => b[1] - a[1]), disputeRate: orders.length > 0 ? (disputes.length / orders.length) * 100 : 0 };
  }, [disputes, orders]);

  const shipmentStats = useMemo(() => {
    const now = Date.now();
    const toShip = orders.filter((o) => o.status === 'pending' || o.status === 'awaiting_shipment');
    const inTransit = orders.filter((o) => o.status === 'shipped' || o.status === 'in_progress');
    const deliveredOrders = orders.filter((o) => o.status === 'delivered' || o.status === 'completed');
    const delayed = orders.filter((o) => {
      if (!o.expected_delivery) return false;
      if (o.status === 'delivered' || o.status === 'completed' || o.status === 'cancelled' || o.status === 'refunded') return false;
      return new Date(o.expected_delivery).getTime() < now;
    });
    const withTracking = orders.filter((o) => o.tracking_number).length;
    return { toShip, inTransit, deliveredOrders, delayed, withTracking, total: orders.length };
  }, [orders]);

  const productStats = useMemo(() => {
    const stats = new Map<string, { units: number; revenue: number; refundedUnits: number; orders: number }>();
    items.forEach((it) => {
      if (!it.product_id) return;
      const st = stats.get(it.product_id) ?? { units: 0, revenue: 0, refundedUnits: 0, orders: 0 };
      st.units += Number(it.quantity);
      st.revenue += Number(it.line_total);
      const order = orders.find((o) => o.id === it.order_id);
      if (order?.status === 'refunded' || order?.status === 'cancelled') st.refundedUnits += Number(it.quantity);
      if (order) st.orders += 1;
      stats.set(it.product_id, st);
    });
    return products
      .map((p) => ({
        product: p,
        units: stats.get(p.id)?.units ?? 0,
        revenue: stats.get(p.id)?.revenue ?? 0,
        refundedUnits: stats.get(p.id)?.refundedUnits ?? 0,
        orders: stats.get(p.id)?.orders ?? 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [products, items, orders]);

  const maxRevenue = Math.max(1, ...revenueSeries.map((p) => p.amount));
  const maxMonthly = Math.max(1, ...monthly.map((p) => p.amount));

  const renderPeriod = (
    <div className="flex rounded-lg border border-border p-0.5">
      {([7, 30, 90] as const).map((d) => (
        <button
          key={d}
          onClick={() => setDays(d)}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            days === d ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {d}D
        </button>
      ))}
    </div>
  );

  const revenueChart = (
    <Card className="p-4 lg:col-span-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Revenue</h2>
          <p className="text-lg font-bold text-foreground">{formatAmount(revenueSeries.reduce((s, p) => s + p.amount, 0))}</p>
        </div>
        {renderPeriod}
      </div>
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={revenueSeries} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
            <defs>
              <linearGradient id="analyticsRevenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.22} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(v: string) => new Date(v + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              tickLine={false}
              axisLine={false}
              minTickGap={28}
            />
            <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} width={44} />
            <Tooltip
              cursor={{ stroke: 'hsl(var(--border))' }}
              contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }}
              labelFormatter={(v) => new Date(String(v) + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
              formatter={(v) => [formatAmount(Number(v)), 'Revenue']}
            />
            <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#analyticsRevenueFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );

  const statusPie = (
    <Card className="p-4 lg:col-span-2">
      <h2 className="mb-3 text-sm font-semibold text-foreground">Order Status</h2>
      {statusBreakdown.length === 0 ? (
        <p className="text-sm text-muted-foreground">No orders yet.</p>
      ) : (
        <>
          <div className="flex h-40 items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusBreakdown} dataKey="value" nameKey="status" innerRadius={40} outerRadius={62} paddingAngle={3} strokeWidth={0}>
                  {statusBreakdown.map((entry, i) => (
                    <Cell key={entry.status} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }} formatter={(v, name) => [v, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {statusBreakdown.map((s, i) => (
              <span key={s.status} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                {s.status} ({s.value})
              </span>
            ))}
          </div>
        </>
      )}
    </Card>
  );

  const monthlyChart = (
    <Card className="p-4 lg:col-span-3">
      <h2 className="mb-3 text-sm font-semibold text-foreground">Monthly Revenue</h2>
      {monthly.length === 0 ? (
        <p className="text-sm text-muted-foreground">No revenue recorded yet.</p>
      ) : (
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} width={44} />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
                contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }}
                formatter={(v) => [formatAmount(Number(v)), 'Revenue']}
              />
              <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );

  const topProductsCard = (
    <Card className="p-4 lg:col-span-2">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Top Products</h2>
        <Link to="/merchant-products" className="text-xs font-medium text-primary hover:underline">
          Manage
        </Link>
      </div>
      {topProducts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No product revenue yet.</p>
      ) : (
        <div className="space-y-2.5">
          {topProducts.map((p) => (
            <div key={p.name}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="truncate text-xs font-medium text-foreground">
                  <span className="text-muted-foreground">#{p.rank}</span> {p.name}
                </p>
                <p className="shrink-0 text-xs font-bold tabular-nums text-foreground">{formatAmount(p.amount)}</p>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${(p.amount / maxRevenue) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );

  const refresh = () => {
    refreshOrders();
    refreshProducts();
    fetchAux();
  };

  return (
    <>
      <div className="mx-auto max-w-5xl px-4 py-5 pb-16 sm:px-6 sm:py-7">
        <MerchantPageHeader
          title="Analytics"
          subtitle="Understand how your store is performing."
          actions={
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4 mr-1.5', loading && 'animate-spin')} /> Refresh
            </Button>
          }
        />

        <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg border border-border p-0.5 w-fit">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
                tab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <Card className="mb-4 flex items-center justify-between gap-3 border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm text-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={refresh}>
              Try Again
            </Button>
          </Card>
        )}

        {loading ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
            <Skeleton className="col-span-2 h-64 rounded-2xl lg:col-span-2" />
            <Skeleton className="col-span-2 h-64 rounded-2xl lg:col-span-2" />
          </div>
        ) : tab === 'overview' ? (
          orders.length === 0 && refunds.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="No data to chart yet"
              description="Once your first order comes in, your analytics will start to build here."
            />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <KpiCard icon={Wallet} label="Revenue · 30d" value={formatAmount(overview.revenue30)} sub={`${overview.totalOrders} lifetime orders`} to="/merchant-transactions?type=payment" />
                <KpiCard icon={TrendingUp} label="Orders · 30d" value={String(overview.orderCount30)} sub={`Avg ${formatAmount(overview.avgOrder)} per order`} to="/merchant-orders" />
                <KpiCard icon={RotateCcw} label="Refund Rate" value={`${overview.refundRate.toFixed(1)}%`} sub={`${overview.refunded} refunded order${overview.refunded === 1 ? '' : 's'}`} to="/merchant-refunds" />
                <KpiCard icon={Gavel} label="Dispute Rate" value={`${overview.disputeRate.toFixed(1)}%`} sub={`${overview.disputed} disputed order${overview.disputed === 1 ? '' : 's'}`} to="/merchant-disputes" />
              </div>
              <div className="grid gap-4 lg:grid-cols-5">
                {revenueChart}
                {statusPie}
              </div>
              <div className="grid gap-4 lg:grid-cols-5">
                {monthlyChart}
                {topProductsCard}
              </div>
            </div>
          )
        ) : tab === 'revenue' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard icon={Wallet} label={`Revenue · ${days}d`} value={formatAmount(revenueOf(orders.filter((o) => within(o.created_at, days))))} sub="Escrow released" to="/merchant-transactions?type=payment&status=success" />
              <KpiCard icon={TrendingUp} label={`Orders · ${days}d`} value={String(orders.filter((o) => within(o.created_at, days)).length)} sub="All orders" to="/merchant-orders" />
              <KpiCard icon={Wallet} label="Lifetime Revenue" value={formatAmount(overview.totalRevenue)} sub={`${overview.totalOrders} orders total`} to="/merchant-transactions" />
              <KpiCard icon={Truck} label="Released" value={String(orders.filter((o) => o.escrow_status === 'released').length)} sub="Escrow released orders" to="/merchant-transactions" />
            </div>
            <div className="grid gap-4 lg:grid-cols-5">
              {revenueChart}
              {monthlyChart}
            </div>
          </div>
        ) : tab === 'refunds' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard icon={RotateCcw} label="Total Refunds" value={String(refundStats.total)} sub={`${formatAmount(refundStats.amount)} refunded`} to="/merchant-refunds" />
              <KpiCard icon={TrendingUp} label="In Progress" value={String(refundStats.inProgress.length)} sub="Initiated or processing" to="/merchant-refunds?status=processing" />
              <KpiCard icon={RotateCcw} label="Completed" value={String(refundStats.success.length)} sub="Successfully refunded" to="/merchant-refunds?status=success" />
              <KpiCard icon={ShieldAlert} label="Failed" value={String(refundStats.failed.length)} sub="Needs attention" to="/merchant-refunds?status=failed" />
            </div>
            <Card className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-foreground">Refund Rate</h2>
              <p className="text-3xl font-extrabold tracking-tight text-foreground">{refundStats.refundRate.toFixed(1)}%</p>
              <p className="mt-1 text-xs text-muted-foreground">{refundStats.success.length} refunds across {orders.length} orders.</p>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-warning transition-all duration-500" style={{ width: `${Math.min(100, refundStats.refundRate)}%` }} />
              </div>
            </Card>
            {refundStats.byReason.length > 0 && (
              <Card className="p-4">
                <h2 className="mb-3 text-sm font-semibold text-foreground">Top Refund Reasons</h2>
                <div className="space-y-2.5">
                  {refundStats.byReason.map(([reason, count]) => (
                    <div key={reason}>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="text-xs font-medium capitalize text-foreground">{reason}</p>
                        <p className="text-xs font-bold tabular-nums text-foreground">{count}</p>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${(count / Math.max(1, refundStats.success.length)) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            {refundStats.success.length === 0 && <p className="text-center text-[11px] text-muted-foreground">No successful refunds yet.</p>}
          </div>
        ) : tab === 'disputes' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard icon={Gavel} label="Total Disputes" value={String(disputeStats.total)} sub={`${disputeStats.disputeRate.toFixed(1)}% of orders`} to="/merchant-disputes" />
              <KpiCard icon={ShieldAlert} label="Under Review" value={String(disputeStats.open.length)} sub="Awaiting resolution" to="/merchant-disputes" />
              <KpiCard icon={Wallet} label="Protected" value={formatAmount(disputeStats.protectedAmount)} sub="Funds held in escrow" to="/merchant-transactions?status=success" />
              <KpiCard icon={CheckCircle2} label="Closed" value={String(disputeStats.closed.length)} sub="Resolved disputes" to="/merchant-disputes" />
            </div>
            {disputeStats.byReason.length > 0 && (
              <Card className="p-4">
                <h2 className="mb-3 text-sm font-semibold text-foreground">Dispute Reasons</h2>
                <div className="grid grid-cols-2 gap-2">
                  {disputeStats.byReason.map(([reason, count]) => (
                    <MiniStat key={reason} label={reason} value={String(count)} tone="info" />
                  ))}
                </div>
              </Card>
            )}
            <Card className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-foreground">Dispute Rate</h2>
              <p className="text-3xl font-extrabold tracking-tight text-foreground">{disputeStats.disputeRate.toFixed(1)}%</p>
              <p className="mt-1 text-xs text-muted-foreground">{disputeStats.total} disputes across {orders.length} orders.</p>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-destructive transition-all duration-500" style={{ width: `${Math.min(100, disputeStats.disputeRate)}%` }} />
              </div>
            </Card>
          </div>
        ) : tab === 'shipments' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard icon={Package} label="To Ship" value={String(shipmentStats.toShip.length)} sub="Awaiting dispatch" to="/merchant-shipments" />
              <KpiCard icon={Truck} label="In Transit" value={String(shipmentStats.inTransit.length)} sub="Shipped orders" to="/merchant-shipments" />
              <KpiCard icon={Package} label="Delivered" value={String(shipmentStats.deliveredOrders.length)} sub="Completed deliveries" to="/merchant-shipments" />
              <KpiCard icon={ShieldAlert} label="Delayed" value={String(shipmentStats.delayed.length)} sub="Past expected delivery" to="/merchant-shipments" />
            </div>
            <Card className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-foreground">Tracking Coverage</h2>
              <p className="text-3xl font-extrabold tracking-tight text-foreground">
                {shipmentStats.total > 0 ? Math.round((shipmentStats.withTracking / shipmentStats.total) * 100) : 0}%
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {shipmentStats.withTracking} of {shipmentStats.total} orders have a tracking number.
              </p>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-success transition-all duration-500" style={{ width: `${shipmentStats.total > 0 ? (shipmentStats.withTracking / shipmentStats.total) * 100 : 0}%` }} />
              </div>
            </Card>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MiniStat label="To Ship" value={String(shipmentStats.toShip.length)} tone="info" />
              <MiniStat label="In Transit" value={String(shipmentStats.inTransit.length)} tone="warning" />
              <MiniStat label="Delivered" value={String(shipmentStats.deliveredOrders.length)} tone="success" />
              <MiniStat label="Delayed" value={String(shipmentStats.delayed.length)} tone="destructive" />
            </div>
            {shipmentStats.delayed.length > 0 && (
              <Link to="/merchant-shipments" className="flex items-center justify-between rounded-2xl border border-warning/30 bg-warning/[0.06] p-4 transition-all hover:border-warning/50">
                <p className="text-sm text-foreground">{shipmentStats.delayed.length} order{shipmentStats.delayed.length > 1 ? 's' : ''} past due — follow up now.</p>
                <ArrowRight className="h-4 w-4 text-warning" />
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard icon={PackageSearch} label="Products" value={String(productStats.length)} sub="In your catalog" to="/merchant-products" />
              <KpiCard icon={Wallet} label="Product Revenue" value={formatAmount(productStats.reduce((s, p) => s + p.revenue, 0))} sub="From linked items" to="/merchant-products" />
              <KpiCard icon={TrendingUp} label="Units Sold" value={String(productStats.reduce((s, p) => s + p.units, 0))} sub="Across all orders" to="/merchant-products" />
              <KpiCard icon={ShieldAlert} label="Out of Stock" value={String(products.filter((p) => p.status === 'out_of_stock').length)} sub="Needs restock" to="/merchant-products" />
            </div>
            {productStats.length === 0 ? (
              <EmptyState icon={PackageSearch} title="No products linked yet" description="Link order items to products to see per-product performance here." />
            ) : (
              <Card className="divide-y divide-border">
                {productStats.map(({ product: p, units, revenue, refundedUnits, orders: orderCount }) => (
                  <Link key={p.id} to={`/merchant-products/${p.id}`} className="flex items-center gap-3 p-3.5 transition-colors hover:bg-muted/40">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
                      {p.image_url ? <img src={p.image_url} alt="" className="h-full w-full object-cover" /> : <Package className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{p.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {units} sold · {orderCount} order{orderCount === 1 ? '' : 's'}
                        {refundedUnits > 0 && <span className="text-destructive"> · {refundedUnits} refunded</span>}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold tabular-nums text-foreground">{formatAmount(revenue)}</p>
                      <StatusBadge
                        tone={p.status === 'out_of_stock' ? 'destructive' : p.status === 'active' ? 'success' : 'neutral'}
                        label={p.status === 'out_of_stock' ? 'Out of stock' : p.status === 'active' ? 'Active' : 'Inactive'}
                        className="text-[10px] px-1.5 py-0.5"
                      />
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                  </Link>
                ))}
              </Card>
            )}
          </div>
        )}
      </div>
      <MerchantBottomNav />
    </>
  );
}
