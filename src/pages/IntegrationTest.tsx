import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Check, CheckCircle2, ExternalLink, FlaskConical, Loader2, Play, XCircle,
} from 'lucide-react';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { MerchantBottomNav } from '@/components/shared/MerchantBottomNav';
import { IntegrationTabs } from '@/components/shared/IntegrationTabs';
import { MerchantPageHeader } from '@/components/merchant/MerchantPageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { FullPageLoading } from '@/components/shared/LoadingSpinner';
import { callCheckoutIntegration, getIntegrationId, type IntegrationTestRun } from '@/lib/checkoutIntegration';

type Step = { name: string; status: 'running' | 'passed' | 'failed' | 'pending'; detail?: string };

const STEP_LABELS: Record<string, string> = {
  api_connection: 'API connection',
  session_creation: 'Session creation',
  checkout_open: 'Checkout page',
  payment: 'Test payment',
  webhook: 'Webhook delivery',
};

export default function IntegrationTest() {
  const navigate = useNavigate();
  const { merchant, isAuthenticated, isLoading: authLoading } = useMerchantAuth();
  const [integrationId, setIntegrationId] = useState<string | null>(null);
  const [runs, setRuns] = useState<IntegrationTestRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [latest, setLatest] = useState<IntegrationTestRun | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [noKey, setNoKey] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/merchant-login', { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (merchant && merchant.verificationStatus !== 'approved') navigate('/merchant-verify', { replace: true });
  }, [merchant, navigate]);

  const fetchRuns = useCallback(async (showLoading = false) => {
    if (!merchant?.id) return;
    try {
      if (showLoading) setIsLoading(true);
      const id = integrationId ?? await getIntegrationId(merchant.id);
      setIntegrationId(id);
      const data = await callCheckoutIntegration<IntegrationTestRun[]>('list-test-runs', { merchantId: merchant.id, integrationId: id });
      setRuns(data);
      if (data.length > 0) setLatest(data[0]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load test runs');
    } finally {
      setIsLoading(false);
    }
  }, [merchant?.id, integrationId]);

  useEffect(() => {
    fetchRuns(true);
  }, [fetchRuns]);

  useEffect(() => {
    if (!latest || latest.status !== 'running') return;
    const interval = setInterval(() => fetchRuns(false), 3000);
    return () => clearInterval(interval);
  }, [latest, fetchRuns]);

  const startRun = async () => {
    if (!merchant?.id || !integrationId) return;
    setStarting(true);
    setNoKey(false);
    try {
      const result = await callCheckoutIntegration<{ run: IntegrationTestRun; checkout_url: string; token: string }>('start-test-run', {
        merchantId: merchant.id,
        integrationId,
      });
      setCheckoutUrl(result.checkout_url);
      setLatest(result.run);
      fetchRuns(false);
      toast.success('Test run started — open the checkout to complete it.');
    } catch (error) {
      if (error instanceof Error && (error as { code?: string }).code === 'NO_TEST_SECRET_KEY') {
        setNoKey(true);
      }
      toast.error(error instanceof Error ? error.message : 'Failed to start test run');
    } finally {
      setStarting(false);
    }
  };

  if (authLoading || !isAuthenticated || !merchant) return <FullPageLoading />;

  const steps: Step[] = Array.isArray(latest?.steps) ? (latest.steps as Step[]) : [];
  const isRunning = latest?.status === 'running';
  const checkoutTarget = checkoutUrl ?? latest?.steps?.find((s) => s.name === 'checkout_open')?.detail;

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="bg-background border-b border-border">
        <div className="px-4 py-5 sm:px-6">
          <MerchantPageHeader
            title="Test Mode"
            back={{ fallback: '/merchant/integration', label: 'Back to Integration' }}
          />
        </div>
        <IntegrationTabs />
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        <div className="px-4 py-4">
          <div className="rounded-xl border border-border bg-card p-4 mb-4">
            <p className="text-sm font-semibold mb-1">Test your integration</p>
            <p className="text-xs text-muted-foreground mb-4">
              Runs a real checkout with your test API key. No money moves and nothing touches Razorpay — SafePay's test handshake completes instantly.
            </p>
            <Button className="w-full" onClick={startRun} disabled={starting || (isRunning && !checkoutTarget)}>
              {starting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
              {starting ? 'Starting…' : 'Start test run'}
            </Button>
            {noKey && (
              <p className="text-xs text-warning mt-3">
                You need a test secret key first. Create one in the API Keys tab.
              </p>
            )}
          </div>

          {isLoading && !latest ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          ) : latest ? (
            <>
              <div className="rounded-xl border border-border bg-card p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold">Latest run</p>
                  <StatusBadge tone={latest.status === 'passed' ? 'success' : latest.status === 'failed' ? 'destructive' : 'warning'} label={latest.status} dot />
                </div>
                <p className="text-[11px] text-muted-foreground mb-3">
                  Started {new Date(latest.started_at).toLocaleString('en-IN')}
                  {latest.finished_at ? ` · Finished ${new Date(latest.finished_at).toLocaleString('en-IN')}` : ''}
                </p>
                <div className="space-y-2">
                  {steps.map((step) => (
                    <div key={step.name} className="flex items-start gap-2">
                      {step.status === 'passed' ? <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                        : step.status === 'failed' ? <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                        : step.status === 'running' ? <Loader2 className="h-4 w-4 text-warning mt-0.5 shrink-0 animate-spin" />
                        : <span className="h-4 w-4 rounded-full border border-muted mt-0.5 shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-sm">{STEP_LABELS[step.name] ?? step.name}</p>
                        {step.detail && <p className="text-xs text-muted-foreground break-all">{step.detail}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {checkoutTarget && (
                <a
                  href={checkoutTarget}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-primary/40 bg-primary/5 p-4 flex items-center gap-2 mb-4 touch-target"
                >
                  <FlaskConical className="h-5 w-5 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">Open test checkout</p>
                    <p className="text-xs text-muted-foreground truncate">{checkoutTarget}</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-primary" />
                </a>
              )}
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <FlaskConical className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No test runs yet.</p>
            </div>
          )}

          {runs.length > 1 && (
            <>
              <p className="text-sm font-semibold mb-2">History</p>
              <div className="rounded-xl border border-border divide-y divide-border">
                {runs.slice(1).map((run) => (
                  <div key={run.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{new Date(run.started_at).toLocaleString('en-IN')}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {Array.isArray(run.steps) && run.steps.filter((s) => s.status === 'passed').length}/{Array.isArray(run.steps) ? run.steps.length : 0} steps passed
                      </p>
                    </div>
                    <StatusBadge tone={run.status === 'passed' ? 'success' : run.status === 'failed' ? 'destructive' : 'warning'} label={run.status} />
                  </div>
                ))}
              </div>
            </>
          )}

          {latest && latest.status === 'passed' && (
            <div className="rounded-xl border border-success/30 bg-success/5 p-4 flex items-center gap-2">
              <Check className="h-4 w-4 text-success" />
              <p className="text-sm">All checks passed. Your integration is ready for live mode.</p>
            </div>
          )}
        </div>
      </main>

      <MerchantBottomNav />
    </div>
  );
}
