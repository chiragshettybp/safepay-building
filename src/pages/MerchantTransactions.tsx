import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, ChevronRight, Landmark, RefreshCw, RotateCcw, Search, Wallet } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MerchantPageHeader } from '@/components/merchant/MerchantPageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge, type StatusTone } from '@/components/shared/StatusBadge';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { useMerchantTransactions } from '@/hooks/useMerchantTransactions';
import { MerchantBottomNav } from '@/components/shared/MerchantBottomNav';
import { formatAmount } from '@/lib/format';
import { cn } from '@/lib/utils';

const TX_TABS = [
  { key: 'all', label: 'All' },
  { key: 'payment', label: 'Payments' },
  { key: 'refund', label: 'Refunds' },
  { key: 'payout', label: 'Payouts' },
] as const;

const STATUS_TONE: Record<string, { tone: StatusTone; label: string }> = {
  success: { tone: 'success', label: 'Success' },
  succeeded: { tone: 'success', label: 'Succeeded' },
  completed: { tone: 'success', label: 'Completed' },
  captured: { tone: 'success', label: 'Captured' },
  processed: { tone: 'success', label: 'Processed' },
  pending: { tone: 'neutral', label: 'Pending' },
  failed: { tone: 'destructive', label: 'Failed' },
  processing: { tone: 'warning', label: 'Processing' },
};

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: 'in' | 'out' | 'net' }) {
  return (
    <Card className={cn('p-4', tone === 'in' && 'border-success/30 bg-success/[0.05]', tone === 'out' && 'border-destructive/30 bg-destructive/[0.05]')}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-xl font-bold tracking-tight', tone === 'in' ? 'text-success' : tone === 'out' ? 'text-destructive' : 'text-foreground')}>
        {value}
      </p>
    </Card>
  );
}

export default function MerchantTransactions() {
  const { merchant } = useMerchantAuth();
  const { loading, error, transactions, wallet, refresh } = useMerchantTransactions(merchant?.id ?? '');
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<(typeof TX_TABS)[number]['key']>(() => {
    const v = searchParams.get('type');
    return v && (['payment', 'refund', 'payout'] as string[]).includes(v) ? (v as (typeof TX_TABS)[number]['key']) : 'all';
  });
  const [statusParam, setStatusParam] = useState<string>(searchParams.get('status') ?? 'all');
  const [query, setQuery] = useState('');

  const currency = wallet?.currency ?? 'INR';

  const updateParams = (nextTab: (typeof TX_TABS)[number]['key'], nextStatus: string) => {
    setTab(nextTab);
    setStatusParam(nextStatus);
    const params = new URLSearchParams();
    if (nextTab !== 'all') params.set('type', nextTab);
    if (nextStatus !== 'all') params.set('status', nextStatus);
    setSearchParams(params, { replace: true });
  };

  const filtered = useMemo(() => {
    let list = transactions;
    if (tab !== 'all') list = list.filter((t) => t.type === tab);
    if (statusParam !== 'all') list = list.filter((t) => t.status === statusParam);
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((t) => t.label.toLowerCase().includes(q) || t.reference.toLowerCase().includes(q));
    }
    return list;
  }, [transactions, tab, statusParam, query]);

  const totals = useMemo(() => {
    const inflow = transactions.filter((t) => t.type === 'payment' && (t.status === 'success' || t.status === 'succeeded' || t.status === 'captured' || t.status === 'completed')).reduce((s, t) => s + Math.abs(t.amount), 0);
    const outflow = transactions.filter((t) => t.type !== 'payment').reduce((s, t) => s + Math.abs(t.amount), 0);
    return { inflow, outflow, net: inflow - outflow };
  }, [transactions]);

  return (
    <>
    <div className="mx-auto max-w-5xl px-4 py-5 pb-16 sm:px-6 sm:py-7">
      <MerchantPageHeader
        title="Transactions"
        subtitle="Every payment, refund and payout across your business."
        actions={
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-1.5', loading && 'animate-spin')} /> Refresh
          </Button>
        }
      />

      {loading ? (
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      ) : (
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryCard label="Money In" value={formatAmount(totals.inflow, currency)} tone="in" />
          <SummaryCard label="Money Out" value={formatAmount(totals.outflow, currency)} tone="out" />
          <SummaryCard label="Net" value={formatAmount(totals.net, currency)} tone="net" />
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
        <div className="flex gap-1 rounded-lg border border-border p-0.5 w-fit">
          {TX_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => updateParams(t.key, statusParam)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                tab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusParam} onValueChange={(v) => updateParams(tab, v)}>
            <SelectTrigger className="h-9 w-[140px] text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All statuses</SelectItem>
              {Object.entries(STATUS_TONE).map(([key, s]) => (
                <SelectItem key={key} value={key} className="text-xs">
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative sm:w-56">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search transactions..."
              className="h-9 pl-9"
            />
          </div>
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
          icon={Wallet}
          title={query || tab !== 'all' ? 'No matching transactions' : 'No transactions yet'}
          description={query || tab !== 'all' ? 'Try a different search or filter.' : 'Payments, refunds and payouts will appear here as they happen.'}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((tx) => {
            const credit = tx.amount > 0;
            const TypeIcon = tx.type === 'payment' ? ArrowDownRight : tx.type === 'refund' ? RotateCcw : Landmark;
            const typeLabel = tx.type === 'payment' ? 'Payment' : tx.type === 'refund' ? 'Refund' : 'Payout';
            const config = STATUS_TONE[tx.status] ?? { tone: 'neutral' as StatusTone, label: tx.status };
            const href = tx.type === 'payment' ? `/merchant-transactions/${tx.id}` : tx.type === 'refund' ? `/merchant-refunds/${tx.id}` : '/merchant-payout-history';
            return (
              <Link
                key={`${tx.type}-${tx.id}`}
                to={href}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 transition-all hover:border-primary/30 active:scale-[0.99]"
              >
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                    credit ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground',
                  )}
                >
                  <TypeIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{tx.label}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {typeLabel} · {tx.reference} ·{' '}
                    {new Date(tx.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
                <div className="hidden shrink-0 sm:block">
                  <StatusBadge tone={config.tone} label={config.label} dot className="text-[10px] px-1.5 py-0.5" />
                </div>
                <p className={cn('shrink-0 text-sm font-bold tabular-nums', credit ? 'text-success' : 'text-foreground')}>
                  {formatAmount(tx.amount, tx.currency)}
                </p>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
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
