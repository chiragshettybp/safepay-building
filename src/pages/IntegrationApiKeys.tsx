import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Check, Copy, Eye, EyeOff, KeyRound, Loader2, Plus, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { MerchantBottomNav } from '@/components/shared/MerchantBottomNav';
import { IntegrationTabs } from '@/components/shared/IntegrationTabs';
import { MerchantPageHeader } from '@/components/merchant/MerchantPageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { FullPageLoading } from '@/components/shared/LoadingSpinner';
import {
  callCheckoutIntegration,
  getIntegrationId,
  keyTone,
  type ApiKeyRow,
  type CreatedApiKey,
} from '@/lib/checkoutIntegration';

export default function IntegrationApiKeys() {
  const navigate = useNavigate();
  const { merchant, isAuthenticated, isLoading: authLoading } = useMerchantAuth();
  const [integrationId, setIntegrationId] = useState<string | null>(null);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [keyEnv, setKeyEnv] = useState<'test' | 'live'>('test');
  const [keyType, setKeyType] = useState<'publishable' | 'secret'>('secret');
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null);

  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/merchant-login', { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (merchant && merchant.verificationStatus !== 'approved') navigate('/merchant-verify', { replace: true });
  }, [merchant, navigate]);

  const fetchKeys = useCallback(async () => {
    if (!merchant?.id) return;
    try {
      setIsLoading(true);
      const id = await getIntegrationId(merchant.id);
      setIntegrationId(id);
      const data = await callCheckoutIntegration<ApiKeyRow[]>('list-api-keys', { merchantId: merchant.id, integrationId: id });
      setKeys(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load API keys');
    } finally {
      setIsLoading(false);
    }
  }, [merchant?.id]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const createKey = async () => {
    if (!merchant?.id || !integrationId) return;
    setCreating(true);
    try {
      const created = await callCheckoutIntegration<CreatedApiKey>('create-api-key', {
        merchantId: merchant.id,
        integrationId,
        name: keyName || (keyType === 'secret' ? 'Secret key' : 'Publishable key'),
        keyType,
        environment: keyEnv,
      });
      setCreatedKey(created);
      setKeys((prev) => [created, ...prev]);
      setShowCreate(false);
      setKeyName('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create key');
    } finally {
      setCreating(false);
    }
  };

  const revokeKey = async (keyId: string) => {
    if (!merchant?.id || !integrationId) return;
    setRevokingId(keyId);
    try {
      await callCheckoutIntegration('revoke-api-key', { merchantId: merchant.id, integrationId, keyId });
      setKeys((prev) => prev.map((k) => (k.id === keyId ? { ...k, status: 'revoked', revoked_at: new Date().toISOString() } : k)));
      toast.success('Key revoked');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to revoke key');
    } finally {
      setRevokingId(null);
    }
  };

  const rotateKey = async (keyId: string) => {
    if (!merchant?.id || !integrationId) return;
    setRotatingId(keyId);
    try {
      const created = await callCheckoutIntegration<CreatedApiKey>('rotate-api-key', { merchantId: merchant.id, integrationId, keyId });
      setKeys((prev) => prev.map((k) => (k.id === keyId ? { ...k, status: 'revoked' } : k)));
      setCreatedKey(created);
      toast.success('New key generated — copy it now, it is shown once.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to rotate key');
    } finally {
      setRotatingId(null);
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

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="bg-background border-b border-border">
        <div className="px-4 py-5 sm:px-6">
          <MerchantPageHeader
            title="API Keys"
            back={{ fallback: '/merchant/integration', label: 'Back to Integration' }}
            actions={
              <Button size="sm" className="h-9" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4 mr-1" /> New key
              </Button>
            }
          />
        </div>
        <IntegrationTabs />
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        <div className="px-4 py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Secret keys authenticate server-side API requests. Publishable keys are safe to embed client-side. Keys are shown once at creation — store them securely.
          </p>

          {/* Create form */}
          {showCreate && (
            <div className="rounded-xl border border-border bg-card p-4 mb-4">
              <p className="text-sm font-semibold mb-3">Create API key</p>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Key name</Label>
                  <Input value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="e.g. Production server" className="mt-1" maxLength={60} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Environment</Label>
                  <RadioGroup value={keyEnv} onValueChange={(v) => setKeyEnv(v as 'test' | 'live')} className="flex gap-4 mt-1">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="test" id="env-test" />
                      <Label htmlFor="env-test" className="text-sm">Test</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="live" id="env-live" />
                      <Label htmlFor="env-live" className="text-sm">Live</Label>
                    </div>
                  </RadioGroup>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Key type</Label>
                  <RadioGroup value={keyType} onValueChange={(v) => setKeyType(v as 'publishable' | 'secret')} className="flex gap-4 mt-1">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="secret" id="type-secret" />
                      <Label htmlFor="type-secret" className="text-sm">Secret</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="publishable" id="type-pub" />
                      <Label htmlFor="type-pub" className="text-sm">Publishable</Label>
                    </div>
                  </RadioGroup>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" onClick={createKey} disabled={creating}>
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                </div>
              </div>
            </div>
          )}

          {/* One-time secret reveal */}
          {createdKey && createdKey.raw && (
            <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 mb-4">
              <p className="text-sm font-semibold text-warning mb-1">Copy your key now</p>
              <p className="text-xs text-muted-foreground mb-3">This is the only time the full key is shown. Keep it in your backend — never in client code.</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all bg-background rounded-lg px-3 py-2 text-xs border border-border">{createdKey.raw}</code>
                <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={() => copy(createdKey.raw!, createdKey.id)}>
                  {copied === createdKey.id ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}

          {/* Key list */}
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
            </div>
          ) : keys.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <KeyRound className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No API keys yet. Create one to start integrating.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border divide-y divide-border">
              {keys.map((key) => {
                const revealable = key.status === 'active';
                const display = key.status === 'revoked' ? `${key.key_prefix}_••••••••••••${key.last_four}` : revealed[key.id] ? `${key.key_prefix}_${'•'.repeat(10)}${key.last_four}` : `${key.key_prefix}_${'•'.repeat(24)}${key.last_four}`;
                return (
                  <div key={key.id} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{key.name}</p>
                        <StatusBadge tone={key.key_type === 'secret' ? 'warning' : 'info'} label={key.key_type === 'secret' ? 'Secret' : 'Publishable'} />
                        <StatusBadge tone={key.environment === 'live' ? 'success' : 'neutral'} label={key.environment} />
                        <StatusBadge tone={keyTone(key.key_type, key.status)} label={key.status === 'active' ? 'Active' : 'Revoked'} />
                      </div>
                      <div className="flex items-center gap-1">
                        {revealable && (
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setRevealed((r) => ({ ...r, [key.id]: !r[key.id] }))}>
                            {revealed[key.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copy(key.key_prefix + '_' + 'x'.repeat(24) + key.last_four, key.id)} title="Copy redacted">
                          <Copy className="h-4 w-4" />
                        </Button>
                        {key.status === 'active' && (
                          <>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-warning" onClick={() => rotateKey(key.id)} disabled={rotatingId === key.id} title="Rotate">
                              {rotatingId === key.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => revokeKey(key.id)} disabled={revokingId === key.id} title="Revoke">
                              {revokingId === key.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    <code className="text-xs text-muted-foreground break-all">{display}</code>
                    {key.scopes && key.scopes.length > 0 && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Scopes: {key.scopes.join(', ')}
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Created {new Date(key.created_at).toLocaleDateString('en-IN')} · {key.status === 'revoked' && key.revoked_at ? `Revoked ${new Date(key.revoked_at).toLocaleDateString('en-IN')} · ` : ''}
                      {key.last_used_at ? `Last used ${new Date(key.last_used_at).toLocaleString('en-IN')}` : 'Never used'}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          <div className="rounded-xl border border-border bg-card p-4 mt-4 flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 text-success mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              Live-mode keys are only issued once the live environment is enabled on your integration. Test keys never charge real money.
            </p>
          </div>
        </div>
      </main>

      <MerchantBottomNav />
    </div>
  );
}
