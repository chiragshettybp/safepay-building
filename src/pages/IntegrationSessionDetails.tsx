import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, RefreshCw, XCircle } from 'lucide-react';
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
  type IntegrationSessionDetail,
} from '@/lib/checkoutIntegration';

export default function IntegrationSessionDetails() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const { merchant, isAuthenticated, isLoading: authLoading } = useMerchantAuth();
  const [integrationId, setIntegrationId] = useState<string | null>(null);
  const [detail, setDetail] = useState<IntegrationSessionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/merchant-login', { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (merchant && merchant.verificationStatus !== 'approved') navigate('/merchant-verify', { replace: true });
  }, [merchant, navigate]);

  const fetchDetail = useCallback(async () => {
    if (!merchant?.id || !sessionId) return;
    try {
      setIsLoading(true);
      const id = await getIntegrationId(merchant.id);
      setIntegrationId(id);
      const data = await callCheckoutIntegration<IntegrationSessionDetail>('get-session', {
        merchantId: merchant.id,
        integrationId: id,
        sessionId,
      });
      setDetail(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load session');
    } finally {
      setIsLoading(false);
    }
  }, [merchant?.id, sessionId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const cancel = async () => {
    if (!merchant?.id || !integrationId || !sessionId) return;
    setCancelling(true);
    try {
      await callCheckoutIntegration('cancel-session', {
        merchantId: merchant.id,
        integrationId,
        sessionId,
      });
      toast.success('Session cancelled');
      fetchDetail();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Cancel failed');
    } finally {
      setCancelling(false);
    }
  };

  if (authLoading || !isAuthenticated || !merchant) return <FullPageLoading />;

  const s = detail;
  const canCancel = s && (s.status === 'active' || s.status === 'processing' || s.status === 'awaiting_payment');
  const p = s?.payment;

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="bg-background border-b border-border">
        <div className="px-4 py-5 sm:px-6">
          <MerchantPageHeader
            title="Session"
            back={{ fallback: '/merchant/integration/sessions', label: 'Back to Sessions' }}
            actions={
              <Button size="icon" variant="ghost" className="h-9 w-9" onClick={fetchDetail} title="Refresh">
                <RefreshCw className="h-4 w-4" />
              </Button>
            }
          />
        </div>
        <IntegrationTabs />
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        <div className="px-4 py-4">
          {isLoading || !s ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-border bg-card p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold">{s.merchant_order_id || 'Integration session'}</p>
                    <p className="text-xs text-muted-foreground font-mono">{s.public_checkout_id}</p>
                  </div>
                  <StatusBadge tone={integrationStatusMeta(s.status).tone} label={integrationStatusMeta(s.status).label} dot />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Amount</p>
                    <p className="font-semibold">{formatAmount(s.final_amount, s.currency)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Environment</p>
                    <StatusBadge tone={s.environment === 'live' ? 'success' : 'neutral'} label={s.environment ?? 'test'} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Created</p>
                    <p>{new Date(s.created_at).toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Expires</p>
                    <p>{s.expires_at ? new Date(s.expires_at).toLocaleString('en-IN') : '—'}</p>
                  </div>
                </div>
                {canCancel && (
                  <Button size="sm" variant="outline" className="mt-4 w-full text-destructive" onClick={cancel} disabled={cancelling}>
                    {cancelling ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <XCircle className="h-4 w-4 mr-1" />} Cancel session
                  </Button>
                )}
              </div>

              <p className="text-sm font-semibold mb-2">Items</p>
              <div className="rounded-xl border border-border divide-y divide-border mb-4">
                {s.items.length === 0 && <div className="px-4 py-3 text-xs text-muted-foreground">No items</div>}
                {s.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{item.item_name}</p>
                      {item.sku && <p className="text-xs text-muted-foreground">{item.sku}</p>}
                    </div>
                    <p className="text-sm font-semibold">{formatAmount(item.line_total, s.currency)}</p>
                  </div>
                ))}
              </div>

              <p className="text-sm font-semibold mb-2">Amount breakdown</p>
              <div className="rounded-xl border border-border divide-y divide-border mb-4">
                <div className="flex justify-between px-4 py-3"><span className="text-xs text-muted-foreground">Subtotal</span><span className="text-sm">{formatAmount(s.subtotal, s.currency)}</span></div>
                <div className="flex justify-between px-4 py-3"><span className="text-xs text-muted-foreground">Discount</span><span className="text-sm">-{formatAmount(s.discount_amount, s.currency)}</span></div>
                <div className="flex justify-between px-4 py-3"><span className="text-xs text-muted-foreground">Shipping</span><span className="text-sm">{formatAmount(s.shipping_amount, s.currency)}</span></div>
                <div className="flex justify-between px-4 py-3"><span className="text-xs text-muted-foreground">Tax</span><span className="text-sm">{formatAmount(s.tax_amount, s.currency)}</span></div>
                <div className="flex justify-between px-4 py-3"><span className="text-xs text-muted-foreground">Service fee</span><span className="text-sm">{formatAmount(s.service_fee_amount, s.currency)}</span></div>
                <div className="flex justify-between px-4 py-3 bg-muted/40"><span className="text-xs font-medium">Total</span><span className="text-sm font-semibold">{formatAmount(s.final_amount, s.currency)}</span></div>
              </div>

              <p className="text-sm font-semibold mb-2">Customer</p>
              <div className="rounded-xl border border-border divide-y divide-border mb-4">
                <div className="flex justify-between px-4 py-3"><span className="text-xs text-muted-foreground">Name</span><span className="text-sm">{s.guest_name || '—'}</span></div>
                <div className="flex justify-between px-4 py-3"><span className="text-xs text-muted-foreground">Email</span><span className="text-sm">{s.guest_email || '—'}</span></div>
              </div>

              <p className="text-sm font-semibold mb-2">Payment</p>
              {!p ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center mb-4">
                  <p className="text-xs text-muted-foreground">No payment transaction yet.</p>
                </div>
              ) : (
                <div className="rounded-xl border border-border divide-y divide-border mb-4">
                  <div className="flex justify-between px-4 py-3"><span className="text-xs text-muted-foreground">Status</span>
                    <StatusBadge tone={p.status === 'succeeded' || p.status === 'success' ? 'success' : p.status === 'failed' ? 'destructive' : 'warning'} label={p.status} />
                  </div>
                  <div className="flex justify-between px-4 py-3"><span className="text-xs text-muted-foreground">Amount</span><span className="text-sm font-semibold">{formatAmount(p.amount, p.currency)}</span></div>
                  <div className="flex justify-between px-4 py-3"><span className="text-xs text-muted-foreground">Method</span><span className="text-sm">{p.method || '—'}</span></div>
                  <div className="flex justify-between px-4 py-3"><span className="text-xs text-muted-foreground">Payment id</span><span className="text-xs font-mono break-all max-w-[60%] text-right">{p.public_payment_id}</span></div>
                  {p.razorpay_order_id && <div className="flex justify-between px-4 py-3"><span className="text-xs text-muted-foreground">Razorpay order</span><span className="text-xs font-mono break-all max-w-[60%] text-right">{p.razorpay_order_id}</span></div>}
                  {p.razorpay_payment_id && <div className="flex justify-between px-4 py-3"><span className="text-xs text-muted-foreground">Razorpay payment</span><span className="text-xs font-mono break-all max-w-[60%] text-right">{p.razorpay_payment_id}</span></div>}
                  {p.failure_reason && <div className="flex justify-between px-4 py-3"><span className="text-xs text-muted-foreground">Failure</span><span className="text-xs text-destructive break-all max-w-[60%] text-right">{p.failure_reason}</span></div>}
                </div>
              )}

              <p className="text-sm font-semibold mb-2">Payment attempts</p>
              {s.payment_attempts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center mb-4">
                  <p className="text-xs text-muted-foreground">No payment attempts yet.</p>
                </div>
              ) : (
                <div className="rounded-xl border border-border divide-y divide-border mb-4">
                  {s.payment_attempts.map((a, i) => (
                    <div key={i} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium">{a.method || 'Card'}</p>
                        <StatusBadge tone={a.status === 'success' || a.status === 'succeeded' ? 'success' : a.status === 'failed' ? 'destructive' : 'warning'} label={a.status} />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{new Date(a.created_at).toLocaleString('en-IN')}</span>
                        {a.failure_reason && <span className="text-destructive">{a.failure_reason}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {s.order && (
                <>
                  <p className="text-sm font-semibold mb-2">Order</p>
                  <div className="rounded-xl border border-border divide-y divide-border mb-4">
                    <div className="flex justify-between px-4 py-3"><span className="text-xs text-muted-foreground">Order number</span><span className="text-sm">{s.order.order_number}</span></div>
                    <div className="flex justify-between px-4 py-3"><span className="text-xs text-muted-foreground">Status</span><StatusBadge tone="info" label={s.order.status} /></div>
                    <div className="flex justify-between px-4 py-3"><span className="text-xs text-muted-foreground">Escrow</span><span className="text-sm">{s.order.escrow_status}</span></div>
                    <div className="flex justify-between px-4 py-3"><span className="text-xs text-muted-foreground">Order id</span><span className="text-xs font-mono break-all max-w-[60%] text-right">{s.order.public_order_id}</span></div>
                  </div>
                </>
              )}

              {s.completed_at && (
                <div className="rounded-xl border border-success/30 bg-success/5 p-4 mb-4 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <div>
                    <p className="text-sm font-medium">Session completed</p>
                    <p className="text-xs text-muted-foreground">{new Date(s.completed_at).toLocaleString('en-IN')}</p>
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
