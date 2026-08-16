import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
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
  AlertCircle,
  Gavel,
  Package,
  Pencil,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  ShoppingCart,
  Trash2,
  TrendingUp,
  Truck,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MerchantPageHeader } from '@/components/merchant/MerchantPageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge, type StatusTone } from '@/components/shared/StatusBadge';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { MerchantBottomNav } from '@/components/shared/MerchantBottomNav';
import { ProductFormSheet } from '@/components/merchant/ProductFormSheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatAmount } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { MerchantProductRow } from '@/hooks/useMerchantProducts';

const PIE_COLORS = ['hsl(var(--primary))', 'hsl(var(--info))', 'hsl(var(--warning))', 'hsl(var(--success))', 'hsl(var(--destructive))', 'hsl(var(--muted-foreground))'];

const ORDER_STATUS_TONE: Record<string, { tone: StatusTone; label: string }> = {
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

const REFUND_STATUS_TONE: Record<string, { tone: StatusTone; label: string }> = {
  initiated: { tone: 'info', label: 'Initiated' },
  processing: { tone: 'warning', label: 'Processing' },
  success: { tone: 'success', label: 'Completed' },
  failed: { tone: 'destructive', label: 'Failed' },
};

const SHIP_STATUS_TONE: Record<string, { tone: StatusTone; label: string }> = {
  pending: { tone: 'neutral', label: 'Pending' },
  in_transit: { tone: 'info', label: 'In Transit' },
  out_for_delivery: { tone: 'info', label: 'Out for delivery' },
  delivered: { tone: 'success', label: 'Delivered' },
  failed: { tone: 'destructive', label: 'Failed' },
};

interface LinkedOrder {
  id: string;
  public_order_id: string | null;
  order_number: string;
  status: string;
  escrow_status: string | null;
  amount: number;
  currency: string | null;
  created_at: string;
  quantity: number;
  line_total: number;
}

interface LinkedTx {
  id: string;
  order_id: string;
  public_payment_id: string | null;
  amount: number;
  currency: string | null;
  status: string;
  method: string | null;
  gateway: string | null;
  created_at: string;
}

interface LinkedRefund {
  id: string;
  public_refund_id: string | null;
  order_id: string;
  amount: number;
  currency: string | null;
  status: string;
  reason: string | null;
  created_at: string;
}

interface LinkedShipment {
  id: string;
  order_id: string;
  tracking_number: string | null;
  courier_partner: string | null;
  status: string | null;
  shipment_date: string | null;
  actual_delivery: string | null;
}

interface LinkedDispute {
  id: string;
  public_dispute_id: string | null;
  order_id: string;
  status: string;
  created_at: string;
}

function Kpi({ label, value, sub, icon: Icon }: { label: string; value: string; sub?: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <p className="text-xs font-medium">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </Card>
  );
}

function LinkRow({ label, value, to, sub, icon: Icon }: { label?: string; value: string; to: string; sub?: string; icon: React.ComponentType<{ className?: string }> }) {
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
        <p className="truncate text-[11px] text-muted-foreground">{sub ?? label}</p>
      </div>
    </Link>
  );
}

export default function MerchantProductDetail() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { merchant } = useMerchantAuth();

  const [product, setProduct] = useState<MerchantProductRow | null>(null);
  const [orders, setOrders] = useState<LinkedOrder[]>([]);
  const [transactions, setTransactions] = useState<LinkedTx[]>([]);
  const [refunds, setRefunds] = useState<LinkedRefund[]>([]);
  const [shipments, setShipments] = useState<LinkedShipment[]>([]);
  const [disputes, setDisputes] = useState<LinkedDispute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchProductData = useCallback(async () => {
    if (!productId || !merchant?.id) return;
    setIsLoading(true);
    try {
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();
      if (productError) throw productError;
      if (productData.merchant_id !== merchant.id) {
        toast.error('Access denied');
        navigate('/merchant-products');
        return;
      }
      setProduct(productData as MerchantProductRow);

      const { data: itemsData } = await supabase
        .from('order_items')
        .select(
          'order_id, quantity, line_total, orders(id, public_order_id, order_number, status, escrow_status, amount, currency, created_at)',
        )
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

      const rows = (itemsData ?? []) as Array<{
        order_id: string;
        quantity: number;
        line_total: number;
        orders: {
          id: string;
          public_order_id: string | null;
          order_number: string;
          status: string;
          escrow_status: string | null;
          amount: number;
          currency: string | null;
          created_at: string;
        }[];
      }>;

      const mapped: LinkedOrder[] = rows
        .filter((r) => r.orders && r.orders.length > 0)
        .map((r) => {
          const o = r.orders[0];
          return {
            id: o.id,
            public_order_id: o.public_order_id,
            order_number: o.order_number,
            status: o.status,
            escrow_status: o.escrow_status,
            amount: Number(o.amount),
            currency: o.currency,
            created_at: o.created_at,
            quantity: r.quantity,
            line_total: Number(r.line_total),
          };
        });

      const unique = new Map(mapped.map((o) => [o.id, o]));
      setOrders([...unique.values()]);

      const orderIds = [...unique.keys()];
      if (orderIds.length > 0) {
        const [txRes, refundRes, shipRes, disputeRes] = await Promise.all([
          supabase
            .from('payment_transactions')
            .select('id, order_id, public_payment_id, amount, currency, status, method, gateway, created_at')
            .in('order_id', orderIds)
            .order('created_at', { ascending: false }),
          supabase
            .from('refunds')
            .select('id, public_refund_id, order_id, amount, currency, status, reason, created_at')
            .in('order_id', orderIds)
            .order('created_at', { ascending: false }),
          supabase
            .from('order_tracking')
            .select('id, order_id, tracking_number, courier_partner, status, shipment_date, actual_delivery')
            .in('order_id', orderIds),
          supabase
            .from('disputes')
            .select('id, public_dispute_id, order_id, status, created_at')
            .in('order_id', orderIds)
            .order('created_at', { ascending: false }),
        ]);
        setTransactions((txRes.data ?? []) as LinkedTx[]);
        setRefunds((refundRes.data ?? []) as LinkedRefund[]);
        setShipments((shipRes.data ?? []) as LinkedShipment[]);
        setDisputes((disputeRes.data ?? []) as LinkedDispute[]);
      } else {
        setTransactions([]);
        setRefunds([]);
        setShipments([]);
        setDisputes([]);
      }
    } catch (error) {
      console.error('Product fetch error:', error);
      toast.error('Failed to load product');
    } finally {
      setIsLoading(false);
    }
  }, [productId, merchant?.id, navigate]);

  useEffect(() => {
    fetchProductData();
  }, [fetchProductData]);

  useEffect(() => {
    if (!productId) return;
    const channel = supabase
      .channel(`merchant-product-${productId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter: `id=eq.${productId}` }, () => fetchProductData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items', filter: `product_id=eq.${productId}` }, () => fetchProductData())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [productId, fetchProductData]);

  const analytics = useMemo(() => {
    const unitsSold = orders.reduce((s, o) => s + o.quantity, 0);
    const earnedOrders = orders.filter((o) => o.escrow_status === 'released' || o.status === 'completed' || o.status === 'delivered');
    const grossRevenue = orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.line_total, 0);
    const earnedRevenue = earnedOrders.reduce((s, o) => s + o.line_total, 0);
    const successRefunds = refunds.filter((r) => r.status === 'success');
    const refundTotal = successRefunds.reduce((s, r) => s + Number(r.amount), 0);
    const netRevenue = earnedRevenue - refundTotal;
    const refundRate = orders.length > 0 ? (successRefunds.length / orders.length) * 100 : 0;
    const disputeCount = disputes.filter((d) => d.status !== 'closed' && d.status !== 'rejected').length;
    const disputeRate = orders.length > 0 ? (disputeCount / orders.length) * 100 : 0;
    return { unitsSold, grossRevenue, earnedRevenue, refundTotal, netRevenue, refundRate, disputeRate, orderCount: orders.length };
  }, [orders, refunds, disputes]);

  const monthly = useMemo(() => {
    const bucket = new Map<string, number>();
    orders.forEach((o) => {
      const earned = o.escrow_status === 'released' || o.status === 'completed' || o.status === 'delivered';
      if (!earned) return;
      const key = o.created_at.slice(0, 7);
      bucket.set(key, (bucket.get(key) ?? 0) + o.line_total);
    });
    return [...bucket.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([key, amount]) => ({
        month: new Date(key + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'short' }),
        amount,
      }));
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

  const statusTone = (p: MerchantProductRow): { tone: StatusTone; label: string } => {
    if (p.status === 'active') return { tone: 'success', label: 'Active' };
    if (p.status === 'inactive') return { tone: 'neutral', label: 'Inactive' };
    return { tone: 'warning', label: 'Out of stock' };
  };

  const handleDelete = async () => {
    if (!product) return;
    setDeleting(true);
    const { error } = await supabase.from('products').delete().eq('id', product.id).eq('merchant_id', merchant?.id);
    setDeleting(false);
    if (error) {
      toast.error('Could not delete product');
      return;
    }
    toast.success('Product deleted');
    navigate('/merchant-products');
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-5 pb-16 sm:px-6 sm:py-7">
        <Skeleton className="mb-4 h-9 w-56 rounded-lg" />
        <Skeleton className="mb-5 h-44 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 text-center">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="mb-4 text-muted-foreground">Product not found</p>
        <Button variant="outline" onClick={() => navigate('/merchant-products')}>
          Back to Products
        </Button>
      </div>
    );
  }

  const pTone = statusTone(product);
  const maxMonthly = Math.max(1, ...monthly.map((m) => m.amount));

  return (
    <>
      <div className="mx-auto max-w-5xl px-4 py-5 pb-16 sm:px-6 sm:py-7">
        <MerchantPageHeader
          title={product.name}
          subtitle={product.sku ? `SKU ${product.sku} · Added ${new Date(product.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : `Added ${new Date(product.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
          back={{ fallback: '/merchant-products', label: 'Back to Products' }}
          actions={
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4 mr-1.5" /> Edit
              </Button>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          }
        />

        {/* Hero */}
        <Card className="mb-5 overflow-hidden">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-muted">
              {product.image_url ? (
                <img src={product.image_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <Package className="h-9 w-9 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-2xl font-bold tracking-tight text-foreground">{formatAmount(product.price)}</p>
                <StatusBadge tone={pTone.tone} label={pTone.label} dot />
              </div>
              {product.description && <p className="mt-1 text-sm text-muted-foreground">{product.description}</p>}
              <p className="mt-2 text-[11px] text-muted-foreground">
                {product.stock_quantity} in stock{product.sku ? ` · ${product.sku}` : ''}
              </p>
            </div>
          </div>
        </Card>

        {orders.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="No sales yet"
            description="This product hasn't been purchased yet. Analytics and linked records will appear here once it sells."
          />
        ) : (
          <div className="space-y-5">
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi icon={TrendingUp} label="Net Revenue" value={formatAmount(analytics.netRevenue)} sub={`${formatAmount(analytics.earnedRevenue)} earned · ${formatAmount(analytics.refundTotal)} refunded`} />
              <Kpi icon={ShoppingCart} label="Units Sold" value={String(analytics.unitsSold)} sub={`${analytics.orderCount} order${analytics.orderCount === 1 ? '' : 's'}`} />
              <Kpi icon={RotateCcw} label="Refund Rate" value={`${analytics.refundRate.toFixed(1)}%`} sub={`${refunds.filter((r) => r.status === 'success').length} refunded`} />
              <Kpi icon={Gavel} label="Dispute Rate" value={`${analytics.disputeRate.toFixed(1)}%`} sub={`${disputes.length} dispute${disputes.length === 1 ? '' : 's'}`} />
            </div>

            {/* Charts */}
            <div className="grid gap-4 lg:grid-cols-5">
              <Card className="p-4 lg:col-span-3">
                <h2 className="mb-3 text-sm font-semibold text-foreground">Monthly Revenue</h2>
                {monthly.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">No earned revenue yet.</p>
                ) : (
                  <div className="h-48 w-full">
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

              <Card className="p-4 lg:col-span-2">
                <h2 className="mb-3 text-sm font-semibold text-foreground">Order Status</h2>
                {statusBreakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No orders yet.</p>
                ) : (
                  <>
                    <div className="flex h-36 items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={statusBreakdown} dataKey="value" nameKey="status" innerRadius={34} outerRadius={54} paddingAngle={3} strokeWidth={0}>
                            {statusBreakdown.map((entry, i) => (
                              <Cell key={entry.status} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }} />
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
            </div>

            {/* Linked records */}
            <div className="space-y-4">
              <div>
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" /> Orders <span className="text-muted-foreground font-normal">({orders.length})</span>
                </h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {orders.map((o) => {
                    const c = ORDER_STATUS_TONE[o.status] ?? { tone: 'neutral' as StatusTone, label: o.status };
                    return (
                      <LinkRow
                        key={o.id}
                        icon={ShoppingCart}
                        value={o.public_order_id ?? `#${o.order_number}`}
                        sub={`${formatAmount(o.amount)} · ${new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                        to={`/merchant-order/${o.id}`}
                      />
                    );
                  })}
                </div>
              </div>

              {transactions.length > 0 && (
                <div>
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Wallet className="h-4 w-4 text-muted-foreground" /> Transactions <span className="text-muted-foreground font-normal">({transactions.length})</span>
                  </h2>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {transactions.map((t) => (
                      <LinkRow
                        key={t.id}
                        icon={Wallet}
                        value={t.public_payment_id ?? `Payment ${t.id.slice(0, 8)}`}
                        sub={`${formatAmount(t.amount, t.currency)} · ${t.method ?? t.gateway ?? 'Payment'}`}
                        to={`/merchant-transactions/${t.id}`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {refunds.length > 0 && (
                <div>
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <RotateCcw className="h-4 w-4 text-muted-foreground" /> Refunds <span className="text-muted-foreground font-normal">({refunds.length})</span>
                  </h2>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {refunds.map((r) => {
                      const c = REFUND_STATUS_TONE[r.status] ?? { tone: 'neutral' as StatusTone, label: r.status };
                      return (
                        <LinkRow
                          key={r.id}
                          icon={RotateCcw}
                          value={r.public_refund_id ?? `Refund ${r.id.slice(0, 8)}`}
                          sub={`${formatAmount(r.amount, r.currency)} · ${r.reason ?? 'Order refund'}`}
                          to={`/merchant-refunds/${r.id}`}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {shipments.length > 0 && (
                <div>
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Truck className="h-4 w-4 text-muted-foreground" /> Shipments <span className="text-muted-foreground font-normal">({shipments.length})</span>
                  </h2>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {shipments.map((s) => {
                      const c = SHIP_STATUS_TONE[s.status ?? ''] ?? { tone: 'neutral' as StatusTone, label: s.status ?? 'Unknown' };
                      return (
                        <LinkRow
                          key={s.id}
                          icon={Truck}
                          value={s.tracking_number ?? 'No tracking yet'}
                          sub={`${s.courier_partner ?? 'Courier'} · ${c.label}`}
                          to={`/merchant-shipments/${s.order_id}`}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {disputes.length > 0 && (
                <div>
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Gavel className="h-4 w-4 text-muted-foreground" /> Disputes <span className="text-muted-foreground font-normal">({disputes.length})</span>
                  </h2>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {disputes.map((d) => (
                      <LinkRow
                        key={d.id}
                        icon={Gavel}
                        value={d.public_dispute_id ?? `Dispute ${d.id.slice(0, 8)}`}
                        sub={d.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                        to={`/merchant-dispute-response/${d.id}`}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => navigate('/merchant-analytics')}>
                  <TrendingUp className="h-4 w-4 mr-1.5" /> View Analytics
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-4 w-4 mr-1.5" /> Edit Product
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <ProductFormSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        merchantId={merchant?.id ?? ''}
        product={product}
        onSaved={(saved) => {
          setProduct(saved);
          setEditOpen(false);
        }}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {product.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the product from your catalog. Orders and past records are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MerchantBottomNav />
    </>
  );
}
