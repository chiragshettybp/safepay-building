import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Copy, Check, Loader2, Plug, Plus, RotateCcw, Send, Trash2, Radio,
} from 'lucide-react';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { MerchantBottomNav } from '@/components/shared/MerchantBottomNav';
import { IntegrationTabs } from '@/components/shared/IntegrationTabs';
import { MerchantPageHeader } from '@/components/merchant/MerchantPageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { FullPageLoading } from '@/components/shared/LoadingSpinner';
import {
  callCheckoutIntegration,
  deliveryStatusMeta,
  getIntegrationId,
  INTEGRATION_EVENTS,
  type CreatedWebhookEndpoint,
  type WebhookDeliveryRow,
  type WebhookEndpointRow,
  type WebhookEventRow,
} from '@/lib/checkoutIntegration';

export default function IntegrationWebhooks() {
  const navigate = useNavigate();
  const { merchant, isAuthenticated, isLoading: authLoading } = useMerchantAuth();
  const [integrationId, setIntegrationId] = useState<string | null>(null);
  const [endpoints, setEndpoints] = useState<WebhookEndpointRow[]>([]);
  const [events, setEvents] = useState<WebhookEventRow[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDeliveryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([...INTEGRATION_EVENTS]);
  const [creating, setCreating] = useState(false);
  const [createdEndpoint, setCreatedEndpoint] = useState<CreatedWebhookEndpoint | null>(null);

  const [testingId, setTestingId] = useState<string | null>(null);
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

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
      const id = await getIntegrationId(merchant.id);
      setIntegrationId(id);
      const [eps, evts, dels] = await Promise.all([
        callCheckoutIntegration<WebhookEndpointRow[]>('list-webhook-endpoints', { merchantId: merchant.id, integrationId: id }),
        callCheckoutIntegration<{ events: WebhookEventRow[]; total: number }>('list-webhook-events', { merchantId: merchant.id, integrationId: id, pageSize: 15 }),
        callCheckoutIntegration<{ deliveries: WebhookDeliveryRow[]; total: number }>('list-webhook-deliveries', { merchantId: merchant.id, integrationId: id, pageSize: 15 }),
      ]);
      setEndpoints(eps);
      setEvents(evts.events);
      setDeliveries(dels.deliveries);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load webhooks');
    } finally {
      setIsLoading(false);
    }
  }, [merchant?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const createEndpoint = async () => {
    if (!merchant?.id || !integrationId) return;
    setCreating(true);
    try {
      const created = await callCheckoutIntegration<CreatedWebhookEndpoint>('create-webhook-endpoint', {
        merchantId: merchant.id,
        integrationId,
        url,
        events: selectedEvents,
      });
      setCreatedEndpoint(created);
      setEndpoints((prev) => [created, ...prev]);
      setShowCreate(false);
      setUrl('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create endpoint');
    } finally {
      setCreating(false);
    }
  };

  const toggleEndpoint = async (ep: WebhookEndpointRow) => {
    if (!merchant?.id || !integrationId) return;
    const next = ep.status === 'active' ? 'disabled' : 'active';
    try {
      const updated = await callCheckoutIntegration<WebhookEndpointRow>('update-webhook-endpoint', {
        merchantId: merchant.id,
        integrationId,
        endpointId: ep.id,
        status: next,
      });
      setEndpoints((prev) => prev.map((e) => (e.id === ep.id ? updated : e)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Update failed');
    }
  };

  const deleteEndpoint = async (ep: WebhookEndpointRow) => {
    if (!merchant?.id || !integrationId) return;
    try {
      await callCheckoutIntegration('delete-webhook-endpoint', { merchantId: merchant.id, integrationId, endpointId: ep.id });
      setEndpoints((prev) => prev.filter((e) => e.id !== ep.id));
      toast.success('Endpoint deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Delete failed');
    }
  };

  const testEndpoint = async (ep: WebhookEndpointRow) => {
    if (!merchant?.id || !integrationId) return;
    setTestingId(ep.id);
    try {
      const result = await callCheckoutIntegration<{ delivered: boolean; status: string; http_status?: number }>('test-webhook-endpoint', {
        merchantId: merchant.id,
        integrationId,
        endpointId: ep.id,
      });
      if (result.delivered) toast.success('Test webhook delivered successfully');
      else toast.error(`Test webhook ${result.status}${result.http_status ? ` (HTTP ${result.http_status})` : ''}`);
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Test failed');
    } finally {
      setTestingId(null);
    }
  };

  const replayEvent = async (eventId: string) => {
    if (!merchant?.id || !integrationId) return;
    setReplayingId(eventId);
    try {
      await callCheckoutIntegration('replay-webhook', { merchantId: merchant.id, integrationId, eventId });
      toast.success('Webhook replay queued');
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Replay failed');
    } finally {
      setReplayingId(null);
    }
  };

  const copy = async (value: string, id: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error('Copy failed');
    }
  };

  if (authLoading || !isAuthenticated || !merchant) return <FullPageLoading />;

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) => (prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]));
  };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="bg-background border-b border-border">
        <div className="px-4 py-5 sm:px-6">
          <MerchantPageHeader
            title="Webhooks"
            back={{ fallback: '/merchant/integration', label: 'Back to Integration' }}
            actions={
              <Button size="sm" className="h-9" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add endpoint
              </Button>
            }
          />
        </div>
        <IntegrationTabs />
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        <div className="px-4 py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Payloads are signed with HMAC-SHA256 in the <code className="text-xs">x-safepay-signature</code> header (<code className="text-xs">t=&lt;ts&gt;,v1=&lt;hex&gt;</code>). Retries use exponential backoff.
          </p>

          {showCreate && (
            <div className="rounded-xl border border-border bg-card p-4 mb-4">
              <p className="text-sm font-semibold mb-3">Add webhook endpoint</p>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Endpoint URL</Label>
                  <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.yourshop.com/safepay/webhook" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Events</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {INTEGRATION_EVENTS.map((event) => (
                      <label key={event} className="flex items-center gap-2 text-xs">
                        <Checkbox checked={selectedEvents.includes(event)} onCheckedChange={() => toggleEvent(event)} />
                        {event}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" onClick={createEndpoint} disabled={creating || !url.trim()}>
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                </div>
              </div>
            </div>
          )}

          {createdEndpoint && createdEndpoint.secret && (
            <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 mb-4">
              <p className="text-sm font-semibold text-warning mb-1">Copy the signing secret now</p>
              <p className="text-xs text-muted-foreground mb-3">Use it to verify incoming <code className="text-xs">x-safepay-signature</code> headers. Shown only once.</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all bg-background rounded-lg px-3 py-2 text-xs border border-border">{createdEndpoint.secret}</code>
                <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={() => copy(createdEndpoint.secret!, createdEndpoint.id)}>
                  {copied === createdEndpoint.id ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}

          <p className="text-sm font-semibold mb-2">Endpoints</p>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
            </div>
          ) : endpoints.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center mb-4">
              <Plug className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No webhook endpoints. Add one to receive event notifications.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border divide-y divide-border mb-4">
              {endpoints.map((ep) => (
                <div key={ep.id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-sm font-medium truncate">{ep.url}</p>
                      <StatusBadge tone={ep.status === 'active' ? 'success' : 'neutral'} label={ep.status === 'active' ? 'Active' : 'Disabled'} />
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => testEndpoint(ep)} disabled={testingId === ep.id} title="Send test event">
                        {testingId === ep.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => toggleEndpoint(ep)} title={ep.status === 'active' ? 'Disable' : 'Enable'}>
                        {ep.status === 'active' ? <Radio className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteEndpoint(ep)} title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-1 flex flex-wrap gap-1">
                    {ep.events.map((ev) => <span key={ev} className="bg-muted rounded px-1.5 py-0.5">{ev}</span>)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {ep.last_success_at ? `Last success ${new Date(ep.last_success_at).toLocaleString('en-IN')}` : 'No successful delivery yet'}
                    {ep.last_failure_at ? ` · Last failure ${new Date(ep.last_failure_at).toLocaleString('en-IN')}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}

          <p className="text-sm font-semibold mb-2">Recent events</p>
          {events.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center mb-4">
              <p className="text-xs text-muted-foreground">No events yet.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border divide-y divide-border mb-4">
              {events.map((ev) => {
                const evDeliveries = deliveries.filter((d) => d.webhook_events?.event_id === ev.event_id);
                return (
                  <div key={ev.id} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium font-mono text-xs">{ev.event_id}</p>
                      <div className="flex items-center gap-2">
                        <StatusBadge tone="info" label={ev.event_type} />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => replayEvent(ev.event_id)} disabled={replayingId === ev.event_id} title="Replay">
                          {replayingId === ev.event_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{new Date(ev.created_at).toLocaleString('en-IN')}</p>
                    {evDeliveries.length > 0 ? (
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        {evDeliveries.map((d) => (
                          <StatusBadge key={d.id} tone={deliveryStatusMeta(d.status).tone} label={deliveryStatusMeta(d.status).label} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground mt-1">No endpoint subscribed to this event.</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <MerchantBottomNav />
    </div>
  );
}
