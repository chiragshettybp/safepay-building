import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ScrollText } from 'lucide-react';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { MerchantBottomNav } from '@/components/shared/MerchantBottomNav';
import { IntegrationTabs } from '@/components/shared/IntegrationTabs';
import { MerchantPageHeader } from '@/components/merchant/MerchantPageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { FullPageLoading } from '@/components/shared/LoadingSpinner';
import { callCheckoutIntegration, getIntegrationId, type ApiRequestLogRow } from '@/lib/checkoutIntegration';

const PAGE_SIZE = 25;

export default function IntegrationLogs() {
  const navigate = useNavigate();
  const { merchant, isAuthenticated, isLoading: authLoading } = useMerchantAuth();
  const [integrationId, setIntegrationId] = useState<string | null>(null);
  const [logs, setLogs] = useState<ApiRequestLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/merchant-login', { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (merchant && merchant.verificationStatus !== 'approved') navigate('/merchant-verify', { replace: true });
  }, [merchant, navigate]);

  const fetchLogs = useCallback(async (p: number) => {
    if (!merchant?.id) return;
    try {
      setIsLoading(true);
      const id = integrationId ?? await getIntegrationId(merchant.id);
      setIntegrationId(id);
      const data = await callCheckoutIntegration<{ logs: ApiRequestLogRow[]; total: number }>('list-api-requests', {
        merchantId: merchant.id,
        integrationId: id,
        page: p - 1,
        pageSize: PAGE_SIZE,
      });
      setLogs(data.logs);
      setTotal(data.total);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load logs');
    } finally {
      setIsLoading(false);
    }
  }, [merchant?.id, integrationId]);

  useEffect(() => {
    fetchLogs(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const visible = statusFilter === 'all' ? logs : logs.filter((l) => (statusFilter === 'success' ? l.status_code < 400 : l.status_code >= 400));
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="bg-background border-b border-border">
        <div className="px-4 py-5 sm:px-6">
          <MerchantPageHeader
            title="API Logs"
            back={{ fallback: '/merchant/integration', label: 'Back to Integration' }}
          />
        </div>
        <IntegrationTabs />
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="h-9 w-36 text-xs">
                <SelectValue placeholder="Result" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All requests</SelectItem>
                <SelectItem value="success">Success (2xx)</SelectItem>
                <SelectItem value="error">Errors (4xx/5xx)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{total} requests</p>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          ) : visible.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <ScrollText className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No API requests logged yet. They appear once you call the integration API.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border divide-y divide-border">
              {visible.map((log) => (
                <div key={log.request_id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <StatusBadge tone={log.status_code < 400 ? 'success' : 'destructive'} label={String(log.status_code)} />
                      <p className="text-xs font-medium truncate">{log.method} {log.endpoint}</p>
                    </div>
                    {log.environment && <StatusBadge tone={log.environment === 'live' ? 'success' : 'neutral'} label={log.environment} />}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span>{new Date(log.created_at).toLocaleString('en-IN')}</span>
                    {log.latency_ms != null && <span>{log.latency_ms} ms</span>}
                    {log.error_code && <span className="text-destructive font-mono">{log.error_code}</span>}
                  </div>
                </div>
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
