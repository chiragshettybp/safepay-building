import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Banknote, Link2, Plus, ReceiptText, ShoppingBag, TrendingUp } from 'lucide-react';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { MerchantBottomNav } from '@/components/shared/MerchantBottomNav';
import { MerchantPageHeader } from '@/components/merchant/MerchantPageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { FullPageLoading } from '@/components/shared/LoadingSpinner';
import { formatAmount } from '@/lib/format';
import {
  callPaymentLink,
  type PaymentLinksAnalytics,
  type PaymentLinkRow,
} from '@/lib/paymentLinks';

export default function PaymentLinks() {
  const navigate = useNavigate();
  const { merchant, isAuthenticated, isLoading: authLoading } = useMerchantAuth();
  const [links, setLinks] = useState<PaymentLinkRow[]>([]);
  const [analytics, setAnalytics] = useState<PaymentLinksAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  const fetchData = useCallback(async () => {
    if (!merchant?.id) return;
    try {
      setIsLoading(true);
      const [linksData, analyticsData] = await Promise.all([
        callPaymentLink<PaymentLinkRow[]>('list-links', { merchantId: merchant.id }),
        callPaymentLink<PaymentLinksAnalytics>('analytics', { merchantId: merchant.id }),
      ]);
      setLinks(linksData);
      setAnalytics(analyticsData);
    } catch (error) {
      toast.error('Failed to load payment links data');
    } finally {
      setIsLoading(false);
    }
  }, [merchant?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const metricCards: { label: string; value: string; icon: React.ReactNode }[] = [
    {
      label: 'Created',
      value: analytics ? String(analytics.sessions_created) : '—',
      icon: <ShoppingBag className="w-4 h-4 text-primary" />,
    },
    {
      label: 'Completed',
      value: analytics ? String(analytics.sessions_completed) : '—',
      icon: <Banknote className="w-4 h-4 text-success" />,
    },
    {
      label: 'Revenue',
      value: analytics ? formatAmount(analytics.revenue) : '—',
      icon: <TrendingUp className="w-4 h-4 text-primary" />,
    },
    {
      label: 'Conv.',
      value: analytics ? `${Math.round(analytics.conversion_rate)}%` : '—',
      icon: <ReceiptText className="w-4 h-4 text-warning" />,
    },
  ];

  if (authLoading || !isAuthenticated || !merchant) {
    return <FullPageLoading />;
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <div className="px-4 py-5 sm:px-6">
        <MerchantPageHeader
          title="Payment Links"
          actions={
            <Link to="/payment-links/create">
              <Button size="sm" className="h-9">
                <Plus className="h-4 w-4 mr-1" />
                New
              </Button>
            </Link>
          }
        />
      </div>

      <main className="flex-1 overflow-y-auto pb-20">
        <div className="px-4 py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Create a reusable link and share it anywhere. Every customer who opens it gets their own payment session and order — we hold the money in escrow until you ship.
          </p>

          {/* Metrics */}
          <div className="flex gap-2 overflow-x-auto pb-4 mb-4 -mx-4 px-4 scrollbar-hide">
            {isLoading ? (
              [1, 2, 3, 4].map((i) => (
                <div key={i} className="metric-card">
                  <Skeleton className="h-8 w-8 rounded-lg mb-2" />
                  <Skeleton className="h-5 w-16 mb-1" />
                  <Skeleton className="h-3 w-14" />
                </div>
              ))
            ) : (
              metricCards.map((card) => (
                <div key={card.label} className="metric-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="metric-card-icon bg-primary/10">{card.icon}</div>
                  </div>
                  <p className="metric-card-value">{card.value}</p>
                  <p className="metric-card-label">{card.label}</p>
                </div>
              ))
            )}
          </div>

          {/* Payment links */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-foreground">Payment Links</h2>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-muted/30 rounded-xl p-3">
                  <Skeleton className="h-4 w-28 mb-1.5" />
                  <Skeleton className="h-3 w-36 mb-1.5" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          ) : links.length === 0 ? (
            <div className="bg-muted/30 rounded-xl p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                <Link2 className="text-muted-foreground h-6 w-6" />
              </div>
              <h3 className="text-sm font-medium text-foreground mb-1">No payment links yet</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Create a reusable link to start accepting payments for your products.
              </p>
              <Link to="/payment-links/create">
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Create payment link
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {links.map((link) => (
                <Link
                  key={link.id}
                  to={`/payment-links/${link.id}`}
                  className="block bg-muted/30 rounded-xl p-3 active:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{link.title || link.public_link_id}</p>
                      <p className="text-xs text-muted-foreground font-mono">{link.public_link_id}</p>
                    </div>
                    <StatusBadge
                      tone={link.status === 'active' ? 'success' : link.status === 'inactive' ? 'neutral' : link.status === 'expired' ? 'warning' : 'destructive'}
                      label={link.status}
                      className="text-[10px] px-1.5 py-0.5"
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {link.orders_count} order{link.orders_count === 1 ? '' : 's'} · {link.sessions_count} session{link.sessions_count === 1 ? '' : 's'}
                    </span>
                    <span className="font-semibold text-foreground">{formatAmount(link.revenue)}</span>
                  </div>
                  {link.last_activity_at && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Last activity {formatDate(link.last_activity_at)}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      <MerchantBottomNav />
    </div>
  );
}
