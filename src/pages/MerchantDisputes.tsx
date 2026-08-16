import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Gavel,
  RefreshCw,
  Reply,
  Search,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { MerchantBottomNav } from '@/components/shared/MerchantBottomNav';
import { MerchantPageHeader } from '@/components/merchant/MerchantPageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge, type StatusTone } from '@/components/shared/StatusBadge';
import { FullPageLoading } from '@/components/shared/LoadingSpinner';
import { formatAmount } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Dispute {
  id: string;
  public_dispute_id: string;
  order_id: string;
  customer_id: string;
  reason: string;
  description: string | null;
  issue_type: string | null;
  status: string;
  resolution: string | null;
  created_at: string;
  updated_at: string;
  merchant_not_responded: boolean | null;
  order: {
    public_order_id: string;
    order_number: string;
    product_name: string;
    amount: number;
  } | null;
  customer_name: string | null;
}

type StatusFilter = 'all' | 'open' | 'info_required' | 'under_review' | 'escalated' | 'resolved' | 'closed';

const FILTER_PILLS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Pending' },
  { key: 'info_required', label: 'Info Needed' },
  { key: 'under_review', label: 'Reviewing' },
  { key: 'escalated', label: 'Escalated' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'closed', label: 'Closed' },
];

const STATUS_CONFIG: Record<string, { tone: StatusTone; label: string; icon: typeof Clock; cls: string }> = {
  open: { tone: 'destructive', label: 'Pending', icon: AlertTriangle, cls: 'bg-destructive/10 text-destructive' },
  under_review: { tone: 'info', label: 'Reviewing', icon: Clock, cls: 'bg-warning/10 text-warning' },
  info_required: { tone: 'destructive', label: 'Info Needed', icon: AlertTriangle, cls: 'bg-destructive/10 text-destructive' },
  escalated: { tone: 'destructive', label: 'Escalated', icon: ShieldAlert, cls: 'bg-destructive/10 text-destructive' },
  resolved: { tone: 'success', label: 'Resolved', icon: CheckCircle2, cls: 'bg-success/10 text-success' },
  closed: { tone: 'neutral', label: 'Closed', icon: XCircle, cls: 'bg-muted text-muted-foreground' },
  rejected: { tone: 'neutral', label: 'Rejected', icon: XCircle, cls: 'bg-muted text-muted-foreground' },
};

export default function MerchantDisputes() {
  const navigate = useNavigate();
  const { merchant, isAuthenticated, isLoading: authLoading } = useMerchantAuth();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

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

  const fetchDisputes = useCallback(async () => {
    if (!merchant?.id) return;

    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, public_order_id, order_number, product_name, amount, customer_id')
        .eq('merchant_id', merchant.id);

      if (ordersError) throw ordersError;

      if (!ordersData || ordersData.length === 0) {
        setDisputes([]);
        setIsLoading(false);
        return;
      }

      const orderIds = ordersData.map((o) => o.id);
      const orderMap = new Map(ordersData.map((o) => [o.id, o]));

      const { data: disputesData, error: disputesError } = await supabase
        .from('disputes')
        .select('*')
        .in('order_id', orderIds)
        .order('created_at', { ascending: false });

      if (disputesError) throw disputesError;

      const customerIds = [...new Set((disputesData || []).map((d) => d.customer_id))];
      const { data: customersData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', customerIds);

      const customerMap = new Map((customersData || []).map((c) => [c.id, c.full_name]));

      const mappedDisputes: Dispute[] = (disputesData || []).map((d: any) => ({
        ...d,
        order: orderMap.get(d.order_id)
          ? {
              public_order_id: orderMap.get(d.order_id)!.public_order_id,
              order_number: orderMap.get(d.order_id)!.order_number,
              product_name: orderMap.get(d.order_id)!.product_name,
              amount: orderMap.get(d.order_id)!.amount,
            }
          : null,
        customer_name: customerMap.get(d.customer_id) || 'Unknown',
      }));

      setDisputes(mappedDisputes);
    } catch (error) {
      console.error('Error fetching disputes:', error);
      toast.error('Failed to load disputes');
    } finally {
      setIsLoading(false);
    }
  }, [merchant?.id]);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  useEffect(() => {
    if (!merchant?.id) return;

    const channel = supabase
      .channel('merchant-disputes-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'disputes' }, () => fetchDisputes())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dispute_comments' }, () => fetchDisputes())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dispute_messages' }, () => fetchDisputes())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [merchant?.id, fetchDisputes]);

  const filteredDisputes = disputes.filter((dispute) => {
    const matchesSearch =
      dispute.public_dispute_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dispute.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (dispute.order?.public_order_id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (dispute.order?.order_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (dispute.customer_name || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (statusFilter === 'all') return matchesSearch;
    return matchesSearch && dispute.status === statusFilter;
  });

  const urgentDisputes = disputes.filter((d) => d.status === 'open' || d.status === 'info_required' || d.merchant_not_responded);

  const pillCount = (key: StatusFilter) => (key === 'all' ? disputes.length : disputes.filter((d) => d.status === key).length);

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(dateString).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const renderAction = (dispute: Dispute) => {
    if (dispute.status === 'open' || dispute.status === 'info_required') {
      return (
        <Link to={`/merchant-dispute-response/${dispute.id}`}>
          <Button size="sm" className="h-8 gap-1 text-xs">
            <Reply className="h-3.5 w-3.5" />
            Respond
          </Button>
        </Link>
      );
    }
    if (dispute.status === 'resolved' || dispute.status === 'closed') {
      return (
        <Link to={`/merchant-dispute-result/${dispute.id}`}>
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs">
            <FileText className="h-3.5 w-3.5" />
            Result
          </Button>
        </Link>
      );
    }
    return (
      <Link to={`/merchant-dispute-response/${dispute.id}`}>
        <Button size="sm" variant="outline" className="h-8 gap-1 text-xs">
          View
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </Link>
    );
  };

  if (authLoading || !isAuthenticated || !merchant) {
    return <FullPageLoading />;
  }

  return (
    <>
      <div className="mx-auto max-w-5xl px-4 py-5 pb-16 sm:px-6 sm:py-7">
        <MerchantPageHeader
          title="Disputes"
          subtitle="Resolve buyer disputes before they cost you the sale."
          actions={
            <Button variant="outline" size="sm" onClick={fetchDisputes} disabled={isLoading}>
              <RefreshCw className={cn('h-4 w-4 mr-1.5', isLoading && 'animate-spin')} /> Refresh
            </Button>
          }
        />

        {urgentDisputes.length > 0 && (
          <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-destructive/20 bg-destructive/10 p-3.5">
            <AlertTriangle className="h-[18px] w-[18px] shrink-0 text-destructive" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-destructive">Action required</p>
              <p className="text-[11px] text-destructive/80">
                {urgentDisputes.length} dispute{urgentDisputes.length > 1 ? 's' : ''} need{urgentDisputes.length > 1 ? '' : 's'} your response
              </p>
            </div>
          </div>
        )}

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by dispute, order, or customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 pl-9"
          />
        </div>

        <div className="mb-5 flex gap-1 overflow-x-auto rounded-lg border border-border p-0.5 scrollbar-hide">
          {FILTER_PILLS.map((pill) => (
            <button
              key={pill.key}
              onClick={() => setStatusFilter(pill.key)}
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
                  (pill.key === 'open' || pill.key === 'info_required') && pillCount(pill.key) > 0 && statusFilter !== pill.key && 'bg-destructive/15 text-destructive',
                )}
              >
                {pillCount(pill.key)}
              </span>
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
                <Skeleton className="mt-3 h-4 w-full" />
                <Skeleton className="mt-2 h-3 w-2/3" />
                <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-8 w-24 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredDisputes.length === 0 ? (
          <EmptyState
            icon={Gavel}
            title={searchQuery || statusFilter !== 'all' ? 'No matching disputes' : 'No disputes yet'}
            description={
              searchQuery || statusFilter !== 'all'
                ? 'Try a different search or filter.'
                : 'When a buyer opens a dispute it will show up here.'
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filteredDisputes.map((dispute) => {
              const config = STATUS_CONFIG[dispute.status] ?? STATUS_CONFIG.open;
              const isUrgent = dispute.status === 'open' || dispute.status === 'info_required' || dispute.merchant_not_responded;
              const issueLabel = (dispute.issue_type || dispute.reason || 'General').replace(/_/g, ' ');
              return (
                <div
                  key={dispute.id}
                  className="flex flex-col rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary/30"
                >
                  <div className="flex items-start gap-3">
                    <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', config.cls)}>
                      <config.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate font-mono text-sm font-bold text-foreground">
                          {dispute.public_dispute_id || `#${dispute.id.slice(0, 8)}`}
                        </p>
                        {isUrgent && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        Order {dispute.order?.public_order_id || `#${dispute.order?.order_number || 'N/A'}`}
                      </p>
                    </div>
                    <StatusBadge tone={config.tone} label={config.label} dot className="text-[10px] px-1.5 py-0.5" />
                  </div>

                  <p className="mt-3 line-clamp-1 text-sm font-semibold text-foreground">{dispute.order?.product_name || 'Dispute'}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="truncate">{dispute.customer_name}</span>
                    <span className="size-1 shrink-0 rounded-full bg-muted-foreground/50" />
                    <span className="truncate capitalize">{issueLabel}</span>
                  </p>

                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/60 pt-3">
                    <div className="min-w-0">
                      <p className="text-base font-bold tabular-nums text-foreground">
                        {dispute.order ? formatAmount(dispute.order.amount) : '—'}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{getTimeAgo(dispute.updated_at)}</p>
                    </div>
                    <div className="shrink-0">{renderAction(dispute)}</div>
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
