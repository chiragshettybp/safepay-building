import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Radio } from 'lucide-react';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { MerchantBottomNav } from '@/components/shared/MerchantBottomNav';
import { IntegrationTabs } from '@/components/shared/IntegrationTabs';
import { MerchantPageHeader } from '@/components/merchant/MerchantPageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { FullPageLoading } from '@/components/shared/LoadingSpinner';
import { formatAmount } from '@/lib/format';
import {
  callCheckoutIntegration,
  getIntegrationId,
  integrationStatusMeta,
  type IntegrationSessionRow,
} from '@/lib/checkoutIntegration';

const PAGE_SIZE = 20;

export default function IntegrationSessions() {
  const navigate = useNavigate();
  const { merchant, isAuthenticated, isLoading: authLoading } = useMerchantAuth();
  const [integrationId, setIntegrationId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<IntegrationSessionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'all' | 'active' | 'completed' | 'expired' | 'cancelled' | 'failed'>('all');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/merchant-login', { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (merchant && merchant.verificationStatus !== 'approved') navigate('/merchant-verify', { replace: true });
  }, [merchant, navigate]);

  const fetchSessions = useCallback(async (p: number, s: typeof status) => {
    if (!merchant?.id) return;
    try {
      setIsLoading(true);
      const id = integrationId ?? await getIntegrationId(merchant.id);
      setIntegrationId(id);
      const data = await callCheckoutIntegration<{ sessions: IntegrationSessionRow[]; total: number }>('list-sessions', {
        merchantId: merchant.id,
        integrationId: id,
        page: p - 1,
        pageSize: PAGE_SIZE,
        status: s === 'all' ? undefined : s,
      });
      setSessions(data.sessions);
      setTotal(data.total);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  }, [merchant?.id, integrationId]);

  useEffect(() => {
    setPage(1);
    fetchSessions(1, status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    fetchSessions(page, status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  if (authLoading || !isAuthenticated || !merchant) return <FullPageLoading />;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="bg-background border-b border-border">
        <div className="px-4 py-5 sm:px-6">
          <MerchantPageHeader
            title="Sessions"
            back={{ fallback: '/merchant/integration', label: 'Back to Integration' }}
          />
        </div>
        <IntegrationTabs />
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        <div className="px-4 py-4">
          <div className="flex gap-2 mb-4">
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger className="h-9 w-36 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-muted-foreground mb-2">{total} session{total === 1 ? '' : 's'}</p>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          ) : sessions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <Radio className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No sessions match the current filters.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border divide-y divide-border">
              {sessions.map((s) => (
                <Link key={s.id} to={`/merchant/integration/sessions/${s.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 touch-target">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{s.merchant_order_id || s.public_checkout_id}</p>
                    <p className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString('en-IN')}</p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <div className="flex items-center justify-end gap-1.5 mb-0.5">
                      <StatusBadge tone={s.environment === 'live' ? 'success' : 'neutral'} label={s.environment} />
                      <StatusBadge tone={integrationStatusMeta(s.status).tone} label={integrationStatusMeta(s.status).label} />
                    </div>
                    <p className="text-sm font-semibold">{formatAmount(s.final_amount, s.currency)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          )}
        </div>
      </main>

      <MerchantBottomNav />
    </div>
  );
}
