import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { MerchantBottomNav } from '@/components/shared/MerchantBottomNav';
import { MerchantPageHeader } from '@/components/merchant/MerchantPageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { FullPageLoading } from '@/components/shared/LoadingSpinner';
import { callCheckoutIntegration, type AdminIntegrationRow } from '@/lib/checkoutIntegration';

export default function AdminIntegrations() {
  const navigate = useNavigate();
  const { merchant, isAuthenticated, isLoading: authLoading } = useMerchantAuth();
  const [integrations, setIntegrations] = useState<AdminIntegrationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/merchant-login', { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  const fetchData = useCallback(async () => {
    if (!merchant?.id) return;
    try {
      setIsLoading(true);
      const data = await callCheckoutIntegration<AdminIntegrationRow[]>('admin.list-integrations', { merchantId: merchant.id });
      setIntegrations(data);
    } catch (error) {
      if ((error as { code?: string }).code === 'ADMIN_REQUIRED') setDenied(true);
      else toast.error(error instanceof Error ? error.message : 'Failed to load integrations');
    } finally {
      setIsLoading(false);
    }
  }, [merchant?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const setStatus = async (integrationId: string, patch: { status?: 'active' | 'disabled'; liveEnabled?: boolean }) => {
    if (!merchant?.id) return;
    setUpdating(integrationId);
    try {
      const updated = await callCheckoutIntegration<AdminIntegrationRow>('admin.set-status', {
        merchantId: merchant.id,
        integrationId,
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.liveEnabled !== undefined ? { liveEnabled: patch.liveEnabled } : {}),
      });
      setIntegrations((prev) => prev.map((i) => (i.id === integrationId ? updated : i)));
      toast.success('Integration updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Update failed');
    } finally {
      setUpdating(null);
    }
  };

  if (authLoading || !isAuthenticated || !merchant) return <FullPageLoading />;

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="bg-background border-b border-border">
        <div className="px-4 py-5 sm:px-6">
          <MerchantPageHeader
            title="Integration Admin"
            back={{ fallback: '/merchant/integration', label: 'Back to Integration' }}
          />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        <div className="px-4 py-4">
          {denied ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
              <ShieldAlert className="h-8 w-8 text-destructive mx-auto mb-3" />
              <p className="text-sm font-semibold mb-1">Admin access required</p>
              <p className="text-xs text-muted-foreground">Your account does not have the admin role for this area.</p>
            </div>
          ) : isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
            </div>
          ) : integrations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">No integrations yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {integrations.map((i) => (
                <div key={i.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{i.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{i.public_integration_id}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <StatusBadge tone={i.status === 'active' ? 'info' : 'neutral'} label={i.status} />
                      <StatusBadge tone={i.live_enabled ? 'success' : 'neutral'} label={i.live_enabled ? 'Live' : (i.live_requested ? 'Live requested' : 'Test only')} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{i.merchants?.business_name ?? 'Unknown merchant'}</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm" variant="outline" className="flex-1"
                      onClick={() => setStatus(i.id, { status: i.status === 'active' ? 'disabled' : 'active' })}
                      disabled={updating === i.id}
                    >
                      {updating === i.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                      {i.status === 'active' ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      size="sm" variant="outline" className="flex-1"
                      onClick={() => setStatus(i.id, { liveEnabled: !i.live_enabled })}
                      disabled={updating === i.id}
                    >
                      {updating === i.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <ShieldCheck className="h-3.5 w-3.5 mr-1" />}
                      {i.live_enabled ? 'Disable live' : 'Enable live'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <MerchantBottomNav />
    </div>
  );
}
