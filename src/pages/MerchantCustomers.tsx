import { useMemo, useState } from 'react';
import { RefreshCw, Search, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MerchantPageHeader } from '@/components/merchant/MerchantPageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { useMerchantOrders } from '@/hooks/useMerchantOrders';
import { MerchantBottomNav } from '@/components/shared/MerchantBottomNav';
import { formatAmount } from '@/lib/format';
import { cn } from '@/lib/utils';

interface CustomerGroup {
  customerId: string;
  name: string;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string;
  lastProduct: string;
  repeat: boolean;
}

export default function MerchantCustomers() {
  const { merchant } = useMerchantAuth();
  const { loading, error, orders, refresh } = useMerchantOrders(merchant?.id ?? '');
  const [query, setQuery] = useState('');

  const customers = useMemo(() => {
    const map = new Map<string, CustomerGroup>();
    orders.forEach((o) => {
      const id = o.customer_id ?? 'anonymous';
      const existing = map.get(id);
      const earned = o.escrow_status === 'released' || o.status === 'completed' || o.status === 'delivered';
      if (!existing) {
        map.set(id, {
          customerId: id,
          name: 'Guest customer',
          orderCount: 1,
          totalSpent: earned ? Number(o.amount) : 0,
          lastOrderAt: o.created_at,
          lastProduct: o.product_name,
          repeat: false,
        });
      } else {
        existing.orderCount += 1;
        if (earned) existing.totalSpent += Number(o.amount);
        if (new Date(o.created_at) > new Date(existing.lastOrderAt)) {
          existing.lastOrderAt = o.created_at;
          existing.lastProduct = o.product_name;
        }
        existing.repeat = existing.orderCount > 1;
      }
    });
    return [...map.values()].sort((a, b) => b.totalSpent - a.totalSpent || b.orderCount - a.orderCount);
  }, [orders]);

  const filtered = useMemo(() => {
    if (!query) return customers;
    const q = query.toLowerCase();
    return customers.filter((c) => c.name.toLowerCase().includes(q) || c.customerId.toLowerCase().includes(q));
  }, [customers, query]);

  const summary = useMemo(() => {
    const repeatCount = customers.filter((c) => c.repeat).length;
    const totalSpent = customers.reduce((s, c) => s + c.totalSpent, 0);
    const avgOrder = customers.length > 0 ? totalSpent / customers.reduce((s, c) => s + c.orderCount, 0) : 0;
    return { count: customers.length, repeatCount, totalSpent, avgOrder };
  }, [customers]);

  return (
    <>
    <div className="mx-auto max-w-5xl px-4 py-5 pb-16 sm:px-6 sm:py-7">
      <MerchantPageHeader
        title="Customers"
        subtitle="The people buying from your store, at a glance."
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

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Customers</p>
            <p className="mt-1 text-xl font-bold text-foreground">{summary.count}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Repeat Customers</p>
            <p className="mt-1 text-xl font-bold text-foreground">{summary.repeatCount}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Lifetime Spent</p>
            <p className="mt-1 text-xl font-bold text-foreground">{formatAmount(summary.totalSpent)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Avg. Order Value</p>
            <p className="mt-1 text-xl font-bold text-foreground">{formatAmount(summary.avgOrder)}</p>
          </Card>
        </div>
      )}

      <div className="relative mb-4 sm:w-72">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customers..." className="h-9 pl-9" />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={query ? 'No matching customers' : 'No customers yet'}
          description={query ? 'Try a different search.' : 'Once buyers pay for your orders, they will appear here.'}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <div key={c.customerId} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {c.name
                  .split(' ')
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase() || '?'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">{c.name}</p>
                  {c.repeat && <StatusBadge tone="info" label="Repeat" dot className="text-[10px] px-1.5 py-0.5" />}
                </div>
                <p className="truncate text-[11px] text-muted-foreground">
                  {c.orderCount} order{c.orderCount > 1 ? 's' : ''} · Last: {c.lastProduct} ·{' '}
                  {new Date(c.lastOrderAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </p>
              </div>
              <p className="shrink-0 text-sm font-bold tabular-nums text-foreground">{formatAmount(c.totalSpent)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
      <MerchantBottomNav />
    </>
  );
}
