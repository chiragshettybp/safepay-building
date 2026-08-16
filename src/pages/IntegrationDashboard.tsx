import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Activity, Banknote, CheckCircle2, ExternalLink, KeyRound,
  Loader2, Plug, Radio, ShieldAlert, ShieldCheck, TrendingUp, XCircle,
} from 'lucide-react';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { MerchantBottomNav } from '@/components/shared/MerchantBottomNav';
import { IntegrationTabs } from '@/components/shared/IntegrationTabs';
import { MerchantPageHeader } from '@/components/merchant/MerchantPageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { FullPageLoading } from '@/components/shared/LoadingSpinner';
import { formatAmount } from '@/lib/format';
import {
  callCheckoutIntegration,
  deliveryStatusMeta,
  getIntegrationId,
  integrationStatusMeta,
  type CheckoutIntegration,
  type IntegrationOverview,
} from '@/lib/checkoutIntegration';

export default function IntegrationDashboard() {
  const navigate = useNavigate();
  const { merchant, isAuthenticated, isLoading: authLoading } = useMerchantAuth();
  const [integration, setIntegration] = useState<CheckoutIntegration | null>(null);
  const [overview, setOverview] = useState<IntegrationOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/merchant-login', { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (merchant && merchant.verificationStatus !== 'approved') navigate('/merchant-verify', { replace: true });
  }, [merchant, navigate]);

  const fetchData = useCallback(async () => {
    if (!merchant?.id) return;
    try {
      setIsLoading(true);
      const integrationId = await getIntegrationId(merchant.id);
      const data = await callCheckoutIntegration<IntegrationOverview>('overview', {
        merchantId: merchant.id,
        integrationId,
      });
      setIntegration(data.integration);
      setNewName(data.integration.name);
      setOverview(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load integration');
    } finally {
      setIsLoading(false);
    }
  }, [merchant?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const saveName = async () => {
    if (!merchant?.id || !integration || !newName.trim()) return;
    setSaving(true);
    try {
      const updated = await callCheckoutIntegration<CheckoutIntegration>('update-integration', {
        merchantId: merchant.id,
        integrationId: integration.id,
        name: newName.trim(),
      });
      setIntegration(updated);
      toast.success('Integration name updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update name');
    } finally {
      setSaving(false);
    }
  };

  const requestLive = async () => {
    if (!merchant?.id || !integration) return;
    try {
      await callCheckoutIntegration('request-live', {
        merchantId: merchant.id,
        integrationId: integration.id,
      });
      setIntegration({ ...integration, live_requested: true });
      toast.success('Live mode requested. Our team will review your application.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Request failed');
    }
  };

  if (authLoading || !isAuthenticated || !merchant) return <FullPageLoading />;

  const h = overview?.health;
  const metricCards = [
    { label: 'Sessions', value: h ? String(h.sessions_created) : '—', icon: <Radio className="w-4 h-4 text-primary" /> },
    { label: 'Completed', value: h ? String(h.sessions_completed) : '—', icon: <CheckCircle2 className="w-4 h-4 text-success" /> },
    { label: 'Revenue', value: h ? formatAmount(h.revenue) : '—', icon: <Banknote className="w-4 h-4 text-primary" /> },
    { label: 'Health', value: h ? `${h.health_score}` : '—', icon: <Activity className="w-4 h-4 text-warning" /> },
  ];

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="bg-background border-b border-border">
        <div className="px-4 py-5 sm:px-6">
          <MerchantPageHeader title="Checkout Integration" />
        </div>
        <IntegrationTabs />
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        <div className="px-4 py-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
            </div>
          ) : !integration ? (
            <div className="text-center py-16">
              <p className="text-sm text-muted-foreground">No integration found for your merchant.</p>
              <Button className="mt-4" onClick={() => fetchData()}>Retry</Button>
            </div>
          ) : (
            <>
              {/* Status + environment */}
              <div className="rounded-xl border border-border bg-card p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold text-foreground">Integration</p>
                    <p className="text-xs text-muted-foreground font-mono">{integration.public_integration_id}</p>
                  </div>
                  <StatusBadge tone={integrationStatusMeta(integration.status).tone} label={integrationStatusMeta(integration.status).label} dot />
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="h-9 flex-1" placeholder="Integration name" maxLength={100} />
                  <Button size="sm" className="h-9" onClick={saveName} disabled={saving || !newName.trim() || newName.trim() === integration.name}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className={`rounded-lg p-3 border ${integration.status === 'active' ? 'bg-success/10 border-success/30' : 'bg-muted border-border'}`}>
                    <p className="text-xs text-muted-foreground mb-1">Test mode</p>
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      {integration.status === 'active' ? <ShieldCheck className="h-4 w-4 text-success" /> : <ShieldAlert className="h-4 w-4 text-warning" />}
                      {integration.status === 'active' ? 'Active' : 'Disabled'}
                    </p>
                  </div>
                  <div className={`rounded-lg p-3 border ${integration.live_enabled ? 'bg-success/10 border-success/30' : 'bg-muted border-border'}`}>
                    <p className="text-xs text-muted-foreground mb-1">Live mode</p>
                    {integration.live_enabled ? (
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        <ShieldCheck className="h-4 w-4 text-success" /> Enabled
                      </p>
                    ) : integration.live_requested ? (
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        <ShieldAlert className="h-4 w-4 text-warning" /> Reviewing
                      </p>
                    ) : (
                      <Button size="sm" variant="outline" className="h-8 w-full" onClick={requestLive}>
                        Request live
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Metrics */}
              <div className="flex gap-2 overflow-x-auto pb-4 mb-2 -mx-4 px-4 scrollbar-hide">
                {metricCards.map((card) => (
                  <div key={card.label} className="metric-card">
                    <div className="flex items-center justify-between mb-2">
                      <div className="metric-card-icon bg-primary/10">{card.icon}</div>
                    </div>
                    <p className="metric-card-value">{card.value}</p>
                    <p className="metric-card-label">{card.label}</p>
                  </div>
                ))}
              </div>

              {/* Quick links */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <Link to="/merchant/integration/api-keys" className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2 touch-target">
                  <KeyRound className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">API Keys</p>
                    <p className="text-xs text-muted-foreground">{overview?.keys?.length ?? 0} keys</p>
                  </div>
                </Link>
                <Link to="/merchant/integration/webhooks" className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2 touch-target">
                  <Plug className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">Webhooks</p>
                    <p className="text-xs text-muted-foreground">{overview?.endpoints?.length ?? 0} endpoints</p>
                  </div>
                </Link>
              </div>

              {/* Incidents */}
              {overview?.incidents && overview.incidents.length > 0 && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 mb-4">
                  <p className="text-sm font-semibold text-destructive mb-2">Open incidents</p>
                  <div className="space-y-2">
                    {overview.incidents.map((inc) => (
                      <div key={inc.id} className="flex items-start gap-2 text-sm">
                        {inc.severity === 'critical' ? <XCircle className="h-4 w-4 text-destructive mt-0.5" /> : <ShieldAlert className="h-4 w-4 text-warning mt-0.5" />}
                        <div>
                          <p className="font-medium">{inc.title}</p>
                          {inc.message && <p className="text-xs text-muted-foreground">{inc.message}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent sessions */}
              <p className="text-sm font-semibold mb-2">Recent sessions</p>
              {overview?.recent_sessions && overview.recent_sessions.length > 0 ? (
                <div className="rounded-xl border border-border divide-y divide-border mb-4">
                  {overview.recent_sessions.map((s) => (
                    <Link key={s.id} to={`/merchant/integration/sessions/${s.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 touch-target">
                      <div>
                        <p className="text-sm font-medium">{s.merchant_order_id || s.public_checkout_id}</p>
                        <p className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString('en-IN')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatAmount(s.final_amount, s.currency)}</p>
                        <StatusBadge tone={integrationStatusMeta(s.status).tone} label={integrationStatusMeta(s.status).label} />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-6 text-center mb-4">
                  <ExternalLink className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No sessions yet. Create one from your backend with the API keys, or run a test.</p>
                  <Link to="/merchant/integration/test"><Button size="sm" variant="outline" className="mt-3">Run a test</Button></Link>
                </div>
              )}

              {/* Recent deliveries */}
              {overview?.recent_deliveries && overview.recent_deliveries.length > 0 && (
                <>
                  <p className="text-sm font-semibold mb-2">Recent webhook deliveries</p>
                  <div className="rounded-xl border border-border divide-y divide-border mb-4">
                    {overview.recent_deliveries.map((d) => (
                      <div key={d.id} className="flex items-center justify-between px-4 py-3">
                        <div>
                          <p className="text-sm font-medium">{d.webhook_events?.event_type ?? 'webhook'}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[180px]">{d.webhook_endpoints?.url ?? ''}</p>
                        </div>
                        <StatusBadge tone={deliveryStatusMeta(d.status).tone} label={deliveryStatusMeta(d.status).label} />
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Health strip */}
              {h && (
                <div className="rounded-xl border border-border bg-card p-4 mb-4 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Avg API latency</p>
                    <p className="text-sm font-semibold">{h.avg_api_latency_ms != null ? `${h.avg_api_latency_ms} ms` : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Errors (7d)</p>
                    <p className="text-sm font-semibold">{h.recent_api_errors_7d}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Webhook success</p>
                    <p className="text-sm font-semibold">{h.webhook_successes}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Webhook failures</p>
                    <p className="text-sm font-semibold">{h.webhook_failures}</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <MerchantBottomNav />
    </div>
  );
}
