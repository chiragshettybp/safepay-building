import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { ArrowLeft, Ban, Check, Copy, ExternalLink, Loader2, Power } from 'lucide-react';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { MerchantBottomNav } from '@/components/shared/MerchantBottomNav';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PublicIdBadge } from '@/components/ui/public-id-badge';
import { FullPageLoading } from '@/components/shared/LoadingSpinner';
import { formatAmount } from '@/lib/format';
import {
  callCheckout,
  buildCheckoutLink,
  checkoutStatusMeta,
  type CheckoutLinkDetail,
} from '@/lib/checkout';

const LINK_TONE: Record<string, 'success' | 'neutral' | 'warning' | 'danger'> = {
  active: 'success',
  inactive: 'neutral',
  expired: 'warning',
  cancelled: 'danger',
};

export default function MerchantCheckoutDetails() {
  const navigate = useNavigate();
  const { linkId } = useParams<{ linkId: string }>();
  const { merchant, isAuthenticated, isLoading: authLoading } = useMerchantAuth();
  const [link, setLink] = useState<CheckoutLinkDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const fetchLink = useCallback(async () => {
    if (!merchant?.id || !linkId) return;
    try {
      setIsLoading(true);
      const result = await callCheckout<CheckoutLinkDetail>('get-link', {
        merchantId: merchant.id,
        linkId,
      });
      setLink(result);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to load payment link');
      navigate('/merchant-checkout', { replace: true });
    } finally {
      setIsLoading(false);
    }
  }, [merchant?.id, linkId, navigate]);

  useEffect(() => {
    fetchLink();
  }, [fetchLink]);

  const copyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(buildCheckoutLink(link.token));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast({ title: 'Copied', description: 'Payment link copied to clipboard' });
    } catch {
      toast({ title: 'Copy failed', description: 'Could not access the clipboard', variant: 'destructive' });
    }
  };

  const handleToggleStatus = async (status: 'active' | 'inactive') => {
    if (!merchant?.id || !link) return;
    try {
      setIsToggling(true);
      await callCheckout('set-link-status', { merchantId: merchant.id, linkId: link.id, status });
      toast.success(status === 'active' ? 'Payment link enabled' : 'Payment link disabled');
      fetchLink();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to update payment link');
    } finally {
      setIsToggling(false);
    }
  };

  if (authLoading || !isAuthenticated || !merchant) {
    return <FullPageLoading />;
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border safe-top">
        <div className="flex items-center h-14 px-4">
          <button onClick={() => navigate('/merchant-checkout')} className="p-2 -ml-2 hover:bg-muted rounded-full touch-target" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">Payment link</h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        <div className="px-4 py-4">
          {isLoading || !link ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-muted/30 rounded-xl p-3">
                  <Skeleton className="h-4 w-28 mb-1.5" />
                  <Skeleton className="h-3 w-36 mb-1.5" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-foreground truncate">{link.title || link.public_link_id}</p>
                  <PublicIdBadge value={link.public_link_id} copyable />
                </div>
                <StatusBadge tone={LINK_TONE[link.status] ?? 'neutral'} label={link.status} dot />
              </div>

              <Button className="w-full mb-4" variant="outline" onClick={copyLink}>
                {copied ? <Check className="h-4 w-4 mr-2 text-success" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? 'Link copied' : 'Copy payment link'}
              </Button>

              {/* Items */}
              <div className="bg-muted/30 rounded-xl p-4 mb-4">
                <h2 className="text-sm font-semibold text-foreground mb-3">Items</h2>
                <div className="space-y-2">
                  {link.items.map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{item.item_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.variant_label && `${item.variant_label} · `}
                          {formatAmount(item.unit_price)} × {item.quantity}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-foreground shrink-0">{formatAmount(item.line_total)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Link settings */}
              <div className="bg-muted/30 rounded-xl p-4 mb-4">
                <h2 className="text-sm font-semibold text-foreground mb-3">Settings</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shipping</span>
                    <span className="font-medium text-foreground">{formatAmount(link.shipping_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="font-medium text-foreground">{formatAmount(link.discount_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span className="font-medium text-foreground">{formatAmount(link.tax_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Collect shipping address</span>
                    <span className="font-medium text-foreground">{link.requires_shipping ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Collect email</span>
                    <span className="font-medium text-foreground">{link.collect_email ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Session expiry</span>
                    <span className="font-medium text-foreground">{link.session_expiry_hours} hours</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Link expires</span>
                    <span className="font-medium text-foreground">
                      {link.expires_at
                        ? new Date(link.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
                        : 'Never'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Orders / sessions ledger */}
              <div className="bg-muted/30 rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-foreground">Orders &amp; checkouts</h2>
                  <span className="text-xs text-muted-foreground">
                    {link.sessions.filter((s) => s.status === 'completed').length} paid
                  </span>
                </div>
                {link.sessions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No customer has used this link yet.</p>
                ) : (
                  <div className="space-y-3">
                    {link.sessions.map((session) => {
                      const meta = checkoutStatusMeta(session.status);
                      return (
                        <div key={session.id} className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{session.guest_name || 'Guest'}</p>
                            <p className="text-xs text-muted-foreground font-mono">{session.public_checkout_id}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(session.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                            </p>
                            {session.order_id && (
                              <Link
                                to={`/merchant-order/${session.order_id}`}
                                className="inline-flex items-center text-[11px] font-medium text-primary mt-1"
                              >
                                <ExternalLink className="h-3 w-3 mr-0.5" />
                                {session.order_number || 'View order'}
                              </Link>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className="text-sm font-semibold text-foreground">{formatAmount(session.final_amount)}</span>
                            <StatusBadge tone={meta.tone} label={meta.label} className="text-[10px] px-1.5 py-0.5" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {link.status === 'active' || link.status === 'inactive' ? (
                link.status === 'active' ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="w-full" disabled={isToggling}>
                        {isToggling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Ban className="h-4 w-4 mr-2" />}
                        Disable payment link
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Disable this payment link?</AlertDialogTitle>
                        <AlertDialogDescription>
                          New customers will not be able to pay using this link. Existing orders are unaffected. You can re-enable it anytime.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep link</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleToggleStatus('inactive')}>Disable link</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <Button className="w-full" onClick={() => handleToggleStatus('active')} disabled={isToggling}>
                    {isToggling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Power className="h-4 w-4 mr-2" />}
                    Enable payment link
                  </Button>
                )
              ) : null}
            </>
          )}
        </div>
      </main>

      <MerchantBottomNav />
    </div>
  );
}
