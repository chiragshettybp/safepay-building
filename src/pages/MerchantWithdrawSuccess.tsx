import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import Confetti from '@/components/ui/confetti';

interface Payout {
  id: string;
  amount: number;
  currency: string;
  status: string;
  transaction_id: string | null;
  notes: string | null;
  created_at: string;
  bank_account: {
    bank_name: string;
    account_number: string;
    account_holder_name: string;
  } | null;
}

export default function MerchantWithdrawSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const payoutId = searchParams.get('id');
  const { merchant, isAuthenticated, isLoading: authLoading } = useMerchantAuth();
  const [payout, setPayout] = useState<Payout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/merchant-login', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  useEffect(() => {
    if (!payoutId) {
      navigate('/merchant-payouts', { replace: true });
    }
  }, [payoutId, navigate]);

  const fetchPayout = useCallback(async () => {
    if (!merchant?.id || !payoutId) return;

    try {
      setIsLoading(true);

      const { data, error } = await supabase
        .from('merchant_payouts')
        .select(`
          id,
          amount,
          currency,
          status,
          transaction_id,
          notes,
          created_at,
          merchant_bank_accounts (
            bank_name,
            account_number,
            account_holder_name
          )
        `)
        .eq('id', payoutId)
        .eq('merchant_id', merchant.id)
        .single();

      if (error) {
        console.error('Error fetching payout:', error);
        navigate('/merchant-payouts', { replace: true });
        return;
      }

      if (data) {
        setPayout({
          ...data,
          bank_account: data.merchant_bank_accounts as any
        });
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [merchant?.id, payoutId, navigate]);

  useEffect(() => {
    if (merchant?.id && payoutId) {
      fetchPayout();
    }
  }, [merchant?.id, payoutId, fetchPayout]);

  // Realtime subscription for status updates
  useEffect(() => {
    if (!payoutId) return;

    const channel = supabase
      .channel('payout-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'merchant_payouts',
          filter: `id=eq.${payoutId}`
        },
        () => fetchPayout()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [payoutId, fetchPayout]);

  // Hide confetti after animation
  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30';
      case 'processing': return 'bg-amber-500/15 text-amber-600 border-amber-500/30';
      case 'pending': return 'bg-blue-500/15 text-blue-600 border-blue-500/30';
      case 'failed': return 'bg-red-500/15 text-red-600 border-red-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border">
          <div className="flex items-center h-14 px-4">
            <Skeleton className="h-6 w-32" />
          </div>
        </header>
        <main className="p-4 space-y-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </main>
      </div>
    );
  }

  if (!payout) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {showConfetti && <Confetti />}

      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between h-14 px-4">
          <h1 className="text-lg font-semibold">Withdrawal Submitted</h1>
          <button onClick={() => navigate('/merchant-payouts')} className="p-2 rounded-lg hover:bg-muted">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Success Animation */}
        <div className="text-center py-6">
          <div className="w-20 h-20 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-4 animate-bounce">
            <span className="material-symbols-outlined text-4xl text-emerald-600">check_circle</span>
          </div>
          <h2 className="text-xl font-bold mb-1">Request Submitted!</h2>
          <p className="text-sm text-muted-foreground">
            Your withdrawal request is being processed
          </p>
        </div>

        {/* Payout Summary Card */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 text-center border-b border-border">
            <p className="text-xs text-muted-foreground mb-1">Amount</p>
            <p className="text-3xl font-bold text-primary">{formatCurrency(payout.amount)}</p>
          </div>

          <div className="p-4 space-y-3">
            {/* Status */}
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge className={`${getStatusColor(payout.status)} text-xs capitalize`}>
                {payout.status}
              </Badge>
            </div>

            {/* Transaction ID */}
            {payout.transaction_id && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Transaction ID</span>
                <span className="text-sm font-mono">{payout.transaction_id}</span>
              </div>
            )}

            {/* Date */}
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Requested On</span>
              <span className="text-sm">{format(new Date(payout.created_at), 'dd MMM yyyy, HH:mm')}</span>
            </div>

            {/* Bank Account */}
            {payout.bank_account && (
              <div className="pt-2 border-t border-border">
                <p className="text-[10px] text-muted-foreground mb-2">Depositing to</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <span className="material-symbols-outlined text-lg">account_balance</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{payout.bank_account.bank_name}</p>
                    <p className="text-xs text-muted-foreground">
                      ****{payout.bank_account.account_number.slice(-4)} • {payout.bank_account.account_holder_name}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            {payout.notes && (
              <div className="pt-2 border-t border-border">
                <p className="text-[10px] text-muted-foreground mb-1">Notes</p>
                <p className="text-sm">{payout.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Estimated Time */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/15 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl text-blue-600">schedule</span>
            </div>
            <div>
              <p className="text-sm font-medium text-blue-700">Estimated Deposit Time</p>
              <p className="text-xs text-blue-600/80">1-3 business days</p>
            </div>
          </div>
        </div>

        {/* Info Notice */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-2">What's Next?</h3>
          <ul className="space-y-2 text-xs text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-sm text-primary mt-0.5">check_circle</span>
              <span>Your withdrawal request is being processed</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-sm text-muted-foreground mt-0.5">pending</span>
              <span>Funds will be transferred to your bank account</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-sm text-muted-foreground mt-0.5">notifications</span>
              <span>You'll be notified when the transfer is complete</span>
            </li>
          </ul>
        </div>
      </main>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border safe-bottom">
        <div className="flex gap-3">
          <Link to="/merchant-payout-history" className="flex-1">
            <Button variant="outline" className="w-full h-12 rounded-xl text-sm">
              <span className="material-symbols-outlined text-lg mr-2">history</span>
              View History
            </Button>
          </Link>
          <Link to="/merchant-payouts" className="flex-1">
            <Button className="w-full h-12 rounded-xl text-sm font-semibold">
              <span className="material-symbols-outlined text-lg mr-2">home</span>
              Back to Payouts
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}