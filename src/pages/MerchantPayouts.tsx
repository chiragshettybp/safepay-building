import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Clock,
  CreditCard,
  History,
  Hourglass,
  Landmark,
  Lock,
  PiggyBank,
  Plus,
  ReceiptText,
  Wallet,
  XCircle,
} from 'lucide-react';
import { MerchantBottomNav } from '@/components/shared/MerchantBottomNav';
import { StatusBadge, type StatusTone } from '@/components/shared/StatusBadge';

interface MerchantWallet {
  id: string;
  balance: number;
  pending_balance: number;
  total_earned: number;
  total_withdrawn: number;
  currency: string;
}

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_holder_name: string;
  verification_status: string;
  is_default: boolean;
}

interface Payout {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  bank_account: {
    bank_name: string;
    account_number: string;
  } | null;
}

export default function MerchantPayouts() {
  const navigate = useNavigate();
  const { merchant, isAuthenticated, isLoading: authLoading } = useMerchantAuth();
  const [wallet, setWallet] = useState<MerchantWallet | null>(null);
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);
  const [recentPayouts, setRecentPayouts] = useState<Payout[]>([]);
  const [lastPayout, setLastPayout] = useState<Payout | null>(null);
  const [heldFunds, setHeldFunds] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/merchant-login', { replace: true });
    }
    if (!authLoading && merchant && merchant.verificationStatus !== 'approved') {
      navigate('/merchant-verify', { replace: true });
    }
  }, [merchant, isAuthenticated, authLoading, navigate]);

  const fetchData = useCallback(async () => {
    if (!merchant?.id) return;

    try {
      setIsLoading(true);

      // Fetch wallet
      const { data: walletData, error: walletError } = await supabase
        .from('merchant_wallets')
        .select('*')
        .eq('merchant_id', merchant.id)
        .single();

      if (walletError && walletError.code !== 'PGRST116') {
        console.error('Error fetching wallet:', walletError);
      }

      if (walletData) {
        setWallet(walletData);
      } else {
        // Create wallet if doesn't exist
        const { data: newWallet, error: createError } = await supabase
          .from('merchant_wallets')
          .insert({ merchant_id: merchant.id })
          .select()
          .single();

        if (!createError && newWallet) {
          setWallet(newWallet);
        }
      }

      // Fetch funds held in escrow (payments secured but not yet released)
      const { data: heldData } = await supabase
        .from('orders')
        .select('amount')
        .eq('merchant_id', merchant.id)
        .eq('escrow_status', 'held');

      setHeldFunds((heldData || []).reduce((sum, o: any) => sum + Number(o.amount || 0), 0));

      // Fetch default bank account
      const { data: bankData } = await supabase
        .from('merchant_bank_accounts')
        .select('*')
        .eq('merchant_id', merchant.id)
        .eq('is_default', true)
        .single();

      if (bankData) {
        setBankAccount(bankData);
      }

      // Fetch recent payouts
      const { data: payoutsData } = await supabase
        .from('merchant_payouts')
        .select(`
          id,
          amount,
          currency,
          status,
          created_at,
          merchant_bank_accounts (
            bank_name,
            account_number
          )
        `)
        .eq('merchant_id', merchant.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (payoutsData) {
        const formattedPayouts = payoutsData.map((p: any) => ({
          ...p,
          bank_account: p.merchant_bank_accounts
        }));
        setRecentPayouts(formattedPayouts);
        if (formattedPayouts.length > 0) {
          setLastPayout(formattedPayouts[0]);
        }
      }

    } catch (error) {
      console.error('Error fetching payout data:', error);
      toast.error('Failed to load payout data');
    } finally {
      setIsLoading(false);
    }
  }, [merchant?.id]);

  useEffect(() => {
    if (merchant?.id) {
      fetchData();
    }
  }, [merchant?.id, fetchData]);

  // Realtime subscriptions
  useEffect(() => {
    if (!merchant?.id) return;

    const walletChannel = supabase
      .channel('wallet-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'merchant_wallets',
          filter: `merchant_id=eq.${merchant.id}`
        },
        () => fetchData()
      )
      .subscribe();

    const payoutChannel = supabase
      .channel('payout-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'merchant_payouts',
          filter: `merchant_id=eq.${merchant.id}`
        },
        () => fetchData()
      )
      .subscribe();

    const bankChannel = supabase
      .channel('bank-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'merchant_bank_accounts',
          filter: `merchant_id=eq.${merchant.id}`
        },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(walletChannel);
      supabase.removeChannel(payoutChannel);
      supabase.removeChannel(bankChannel);
    };
  }, [merchant?.id, fetchData]);

  const getStatusTone = (status: string): StatusTone => {
    switch (status) {
      case 'completed': return 'success';
      case 'processing': return 'warning';
      case 'pending': return 'info';
      case 'failed': return 'destructive';
      default: return 'neutral';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const canWithdraw = wallet && wallet.balance > 0 && bankAccount && bankAccount.verification_status === 'verified';

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border">
          <div className="flex items-center justify-between h-14 px-4">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </header>
        <main className="p-4 pb-24 space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/merchant-dashboard')} className="p-1.5 -ml-1.5 rounded-lg hover:bg-muted">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-lg font-semibold">Payouts</h1>
              <p className="text-[10px] text-muted-foreground">Manage earnings & withdrawals</p>
            </div>
          </div>
          <Link to="/merchant-payout-history" className="p-2 rounded-lg hover:bg-muted">
            <History className="h-5 w-5" />
          </Link>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Balance Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="text-primary h-[18px] w-[18px]" />
              <span className="text-[10px] text-muted-foreground">Available</span>
            </div>
            <p className="text-xl font-bold text-primary">{formatCurrency(wallet?.balance || 0)}</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <Hourglass className="text-amber-500 h-[18px] w-[18px]" />
              <span className="text-[10px] text-muted-foreground">Pending</span>
            </div>
            <p className="text-xl font-bold">{formatCurrency(wallet?.pending_balance || 0)}</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <PiggyBank className="text-emerald-500 h-[18px] w-[18px]" />
              <span className="text-[10px] text-muted-foreground">Total Earned</span>
            </div>
            <p className="text-lg font-semibold">{formatCurrency(wallet?.total_earned || 0)}</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <Banknote className="text-blue-500 h-[18px] w-[18px]" />
              <span className="text-[10px] text-muted-foreground">Withdrawn</span>
            </div>
            <p className="text-lg font-semibold">{formatCurrency(wallet?.total_withdrawn || 0)}</p>
          </div>
        </div>

        {/* Escrow Held Funds */}
        {heldFunds > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <Lock className="text-amber-600 h-[18px] w-[18px]" />
              <span className="text-[10px] text-amber-700">Held in Escrow</span>
            </div>
            <p className="text-xl font-bold text-amber-700">{formatCurrency(heldFunds)}</p>
            <p className="text-[10px] text-amber-700/80 mt-1">
              Funds secured in escrow for orders not yet completed. They become available after the order is completed and escrow is released.
            </p>
          </div>
        )}

        {wallet && wallet.balance === 0 && heldFunds > 0 && (
          <div className="bg-muted/40 border border-border rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground">
              Your available balance is ₹0. Payments are held in escrow and will be credited to you once orders are completed.
            </p>
          </div>
        )}

        {/* Last Withdrawal */}
        {lastPayout && (
          <div className="bg-card border border-border rounded-xl p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground mb-0.5">Last Withdrawal</p>
                <p className="text-base font-semibold">{formatCurrency(lastPayout.amount)}</p>
                <p className="text-[10px] text-muted-foreground">{format(new Date(lastPayout.created_at), 'dd MMM yyyy')}</p>
              </div>
              <StatusBadge tone={getStatusTone(lastPayout.status)} label={lastPayout.status} className="text-[10px]" />
            </div>
          </div>
        )}

        {/* Bank Account Section */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Linked Bank Account</h2>
            <Link to="/merchant-bank-account" className="text-primary text-xs font-medium">
              {bankAccount ? 'Change' : 'Add'}
            </Link>
          </div>

          {bankAccount ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <Landmark className="h-[18px] w-[18px]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{bankAccount.bank_name}</p>
                  <p className="text-xs text-muted-foreground">
                    ****{bankAccount.account_number.slice(-4)} • {bankAccount.account_holder_name}
                  </p>
                </div>
                <StatusBadge
                  tone={bankAccount.verification_status === 'verified' ? 'success' : bankAccount.verification_status === 'pending' ? 'warning' : 'destructive'}
                  label={bankAccount.verification_status}
                  className="text-[10px]"
                />
              </div>
              {bankAccount.verification_status !== 'verified' && (
                <p className="text-[10px] text-amber-600 bg-amber-500/10 rounded-lg p-2">
                  ⚠️ Bank verification pending. Withdrawals enabled after verification.
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
                <CreditCard className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground mb-3">No bank account linked</p>
              <Link to="/merchant-bank-account">
                <Button size="sm" className="text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Bank Account
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Recent Payouts */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Recent Payouts</h2>
            <Link to="/merchant-payout-history" className="text-primary text-xs font-medium">
              View All
            </Link>
          </div>

          {recentPayouts.length === 0 ? (
            <div className="text-center py-6">
              <ReceiptText className="h-7 w-7 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No payouts yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentPayouts.map((payout) => (
                <div key={payout.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      payout.status === 'completed' ? 'bg-emerald-500/15' :
                      payout.status === 'failed' ? 'bg-red-500/15' : 'bg-amber-500/15'
                    }`}>
                      {payout.status === 'completed' ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : payout.status === 'failed' ? (
                        <XCircle className="h-4 w-4 text-red-600" />
                      ) : (
                        <Clock className="h-4 w-4 text-amber-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{formatCurrency(payout.amount)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(payout.created_at), 'dd MMM, HH:mm')}
                      </p>
                    </div>
                  </div>
                  <StatusBadge tone={getStatusTone(payout.status)} label={payout.status} className="text-[10px]" />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Bottom Action */}
      <div className="fixed bottom-16 left-0 right-0 p-4 bg-background border-t border-border safe-bottom">
        <Link to="/merchant-withdraw">
          <Button
            className="w-full h-12 text-sm font-semibold rounded-xl"
            disabled={!canWithdraw}
          >
            <Banknote className="h-[18px] w-[18px] mr-2" />
            {!bankAccount ? 'Add Bank Account First' :
             bankAccount.verification_status !== 'verified' ? 'Bank Verification Pending' :
             wallet?.balance === 0 && heldFunds > 0 ? 'Funds Held in Escrow' :
             wallet?.balance === 0 ? 'No Balance to Withdraw' : 'Withdraw Funds'}
          </Button>
        </Link>
      </div>

      <MerchantBottomNav />
    </div>
  );
}