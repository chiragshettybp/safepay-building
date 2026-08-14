import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Tile } from '@/components/ui/Tile';
import { format } from 'date-fns';
import {
  ArrowDownLeft, ArrowUpRight, Building, Check, ChevronRight, Clock,
  History, Lock, Plus, TrendingUp, Wallet as WalletIcon,
} from 'lucide-react';
import { formatWalletTransactionAmount, walletTransactionTone } from '@/lib/format';

interface WalletData {
  id: string;
  balance: number;
  currency: string;
  last_updated: string;
}

interface BankAccount {
  id: string;
  account_holder_name: string;
  account_number: string;
  ifsc_code: string;
  bank_name: string;
  account_type: string;
  is_default: boolean;
  verification_status: string;
}

interface WalletTransaction {
  id: string;
  type: string;
  amount: number;
  currency: string;
  description: string | null;
  status: string;
  created_at: string;
}

interface WalletStats {
  totalRefunds: number;
  totalWithdrawn: number;
  pendingRefunds: number;
  inEscrow: number;
}

export default function Wallet() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<WalletTransaction[]>([]);
  const [stats, setStats] = useState<WalletStats>({ totalRefunds: 0, totalWithdrawn: 0, pendingRefunds: 0, inEscrow: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const fetchWalletData = async () => {
    if (!user?.id) return;

    try {
      // Fetch or create wallet
      let { data: walletData, error: walletError } = await supabase
        .from('wallets')
        .select('*')
        .eq('customer_id', user.id)
        .maybeSingle();

      if (!walletData) {
        // Create wallet if doesn't exist
        const { data: newWallet, error: createError } = await supabase
          .from('wallets')
          .insert({ customer_id: user.id, balance: 0, currency: 'INR' })
          .select()
          .single();
        
        if (createError) throw createError;
        walletData = newWallet;
      }

      setWallet(walletData);

      // Fetch bank accounts
      const { data: accounts } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('customer_id', user.id)
        .order('is_default', { ascending: false });

      setBankAccounts(accounts || []);

      // Fetch recent transactions (for display)
      if (walletData) {
        const { data: recentTx } = await supabase
          .from('wallet_transactions')
          .select('*')
          .eq('wallet_id', walletData.id)
          .order('created_at', { ascending: false })
          .limit(5);

        setRecentTransactions(recentTx || []);

        // Fetch ALL transactions for accurate stats (no limit)
        const { data: allTransactions } = await supabase
          .from('wallet_transactions')
          .select('type, amount, status')
          .eq('wallet_id', walletData.id);

        const txList = allTransactions || [];
        const totalRefunds = txList
          .filter(t => t.type === 'refund' && t.status === 'success')
          .reduce((sum, t) => sum + Number(t.amount), 0);
        const totalWithdrawn = txList
          .filter(t => t.type === 'withdrawal' && t.status === 'success')
          .reduce((sum, t) => sum + Number(t.amount), 0);
        const pendingRefunds = txList
          .filter(t => t.type === 'refund' && t.status === 'pending')
          .reduce((sum, t) => sum + Number(t.amount), 0);

        setStats({ totalRefunds, totalWithdrawn, pendingRefunds, inEscrow: 0 });
      }

      // Calculate escrow balance from orders
      const { data: orders } = await supabase
        .from('orders')
        .select('amount')
        .eq('customer_id', user.id)
        .eq('escrow_status', 'held');

      const inEscrow = (orders || []).reduce((sum, o) => sum + Number(o.amount), 0);
      setStats(prev => ({ ...prev, inEscrow }));

    } catch (error) {
      console.error('Error fetching wallet data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletData();

    // Realtime subscription for wallet updates
    if (user?.id) {
      const channel = supabase
        .channel('wallet-realtime')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'wallets'
        }, () => fetchWalletData())
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'wallet_transactions'
        }, () => fetchWalletData())
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'bank_accounts'
        }, () => fetchWalletData())
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user?.id]);

  const getTransactionIcon = (type: string, status: string) => {
    if (type === 'refund') return <ArrowDownLeft className="w-4 h-4 text-success" />;
    if (walletTransactionTone(type) === 'debit') return <ArrowUpRight className="w-4 h-4 text-destructive" />;
    if (type === 'credit') return <Plus className="w-4 h-4 text-success" />;
    return <WalletIcon className="w-4 h-4 text-primary" />;
  };

  const maskAccountNumber = (number: string) => {
    return '••••' + number.slice(-4);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-6 pb-28">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-4 w-56 mt-2 mb-6" />
          <Skeleton className="h-44 sm:h-52 w-full rounded-2xl sm:rounded-3xl" />
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 mt-4 sm:mt-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 sm:h-24 w-full rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-5 w-44 mt-6 mb-3" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-5 w-48 mt-6 mb-3" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-6 pb-28">

        {/* Title */}
        <header className="mb-5 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">Wallet</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your balance and bank accounts</p>
        </header>

        {/* Balance Card */}
        <section
          aria-label="Wallet balance"
          className="relative mb-4 sm:mb-5 overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary via-blue-700 to-indigo-800 p-5 sm:p-7 text-primary-foreground shadow-subtle animate-fade-in-up"
        >
          <div aria-hidden className="pointer-events-none absolute -right-12 -top-14 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-16 -left-12 h-48 w-48 rounded-full bg-indigo-300/20 blur-3xl" />
          <div className="relative flex items-start justify-between gap-3">
            <p className="text-[11px] sm:text-xs font-medium uppercase tracking-wider text-primary-foreground/70">
              Available Balance
            </p>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-medium text-white">
              <Check className="h-3 w-3" />
              Verified
            </span>
          </div>
          <h2 className="relative mt-1.5 text-3xl sm:text-4xl font-bold tracking-tight tabular-nums">
            ₹{(wallet?.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h2>
          <p className="relative mt-3 text-[11px] text-primary-foreground/60">
            Last updated {wallet?.last_updated ? format(new Date(wallet.last_updated), 'MMM d, h:mm a') : 'just now'}
          </p>
          <div className="relative mt-5 grid grid-cols-2 gap-2.5 sm:gap-3">
            <Link to="/wallet/withdraw" className="contents">
              <Button variant="ghost" className="h-11 rounded-xl bg-white/15 text-white hover:bg-white/25 hover:text-white active:scale-[0.98] transition-all">
                <ArrowUpRight className="h-4 w-4" />
                Withdraw
              </Button>
            </Link>
            <Link to="/wallet/transactions" className="contents">
              <Button variant="ghost" className="h-11 rounded-xl bg-white/15 text-white hover:bg-white/25 hover:text-white active:scale-[0.98] transition-all">
                <History className="h-4 w-4" />
                History
              </Button>
            </Link>
          </div>
        </section>

        {/* Summary Cards */}
        <section
          aria-label="Wallet summary"
          className="mb-5 sm:mb-6 grid grid-cols-2 gap-2.5 sm:gap-3 animate-fade-in-up"
          style={{ animationDelay: '60ms', animationFillMode: 'backwards' }}
        >
          <div className="rounded-2xl border border-border bg-card p-3.5 sm:p-4">
            <div className="flex items-center gap-2">
              <Tile size="xs" tone="success">
                <Icon icon={<TrendingUp />} size="xs" />
              </Tile>
              <p className="truncate text-[11px] font-medium text-muted-foreground">Total Refunds</p>
            </div>
            <p className="mt-2.5 text-base sm:text-lg font-semibold tracking-tight text-foreground tabular-nums">
              ₹{stats.totalRefunds.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3.5 sm:p-4">
            <div className="flex items-center gap-2">
              <Tile size="xs" tone="destructive">
                <Icon icon={<ArrowUpRight />} size="xs" />
              </Tile>
              <p className="truncate text-[11px] font-medium text-muted-foreground">Withdrawn</p>
            </div>
            <p className="mt-2.5 text-base sm:text-lg font-semibold tracking-tight text-foreground tabular-nums">
              ₹{stats.totalWithdrawn.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3.5 sm:p-4">
            <div className="flex items-center gap-2">
              <Tile size="xs" tone="primary">
                <Icon icon={<Lock />} size="xs" />
              </Tile>
              <p className="truncate text-[11px] font-medium text-muted-foreground">In SafePay</p>
            </div>
            <p className="mt-2.5 text-base sm:text-lg font-semibold tracking-tight text-foreground tabular-nums">
              ₹{stats.inEscrow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3.5 sm:p-4">
            <div className="flex items-center gap-2">
              <Tile size="xs" tone="warning">
                <Icon icon={<Clock />} size="xs" />
              </Tile>
              <p className="truncate text-[11px] font-medium text-muted-foreground">Pending</p>
            </div>
            <p className="mt-2.5 text-base sm:text-lg font-semibold tracking-tight text-foreground tabular-nums">
              ₹{stats.pendingRefunds.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </section>

        {/* Linked Bank Accounts */}
        <section
          aria-label="Linked bank accounts"
          className="mb-5 sm:mb-6 animate-fade-in-up"
          style={{ animationDelay: '120ms', animationFillMode: 'backwards' }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Linked Bank Accounts</h3>
            <Link to="/wallet/bank-account" className="text-xs font-medium text-primary">Add New</Link>
          </div>

          {bankAccounts.length > 0 ? (
            <div className="space-y-2.5">
              {bankAccounts.map((account) => (
                <Link
                  key={account.id}
                  to={`/wallet/bank-account/${account.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 sm:p-4 transition-all active:scale-[0.99]"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Building className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{account.bank_name}</p>
                      {account.is_default && (
                        <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">Default</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {account.account_type} • {maskAccountNumber(account.account_number)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge
                      tone={account.verification_status === 'verified' ? 'success' : 'warning'}
                      label={account.verification_status === 'verified' ? 'Verified' : 'Pending'}
                    />
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card px-6 py-8 sm:py-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Building className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-semibold text-foreground">No bank accounts linked</p>
              <p className="mt-1 text-xs text-muted-foreground">Add a bank account to receive refunds</p>
              <Link to="/wallet/bank-account" className="mt-4 inline-flex">
                <Button className="h-11 rounded-xl px-5">
                  <Plus className="h-4 w-4" />
                  Add Bank Account
                </Button>
              </Link>
            </div>
          )}
        </section>

        {/* Recent Transactions */}
        <section
          aria-label="Recent transactions"
          className="animate-fade-in-up"
          style={{ animationDelay: '180ms', animationFillMode: 'backwards' }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Recent Transactions</h3>
            <Link to="/wallet/transactions" className="text-xs font-medium text-primary">View All</Link>
          </div>

          {recentTransactions.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <ul className="divide-y divide-border/70">
                {recentTransactions.map((transaction) => {
                  const tone = walletTransactionTone(transaction.type);
                  const iconBg = tone === 'debit' ? 'bg-destructive/10' : tone === 'credit' ? 'bg-success/10' : 'bg-muted';
                  const amountClass = tone === 'debit' ? 'text-destructive' : tone === 'credit' ? 'text-success' : 'text-foreground';
                  return (
                    <li key={transaction.id} className="flex items-center gap-3 px-4 py-3.5">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
                        {getTransactionIcon(transaction.type, transaction.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-foreground capitalize">
                          {transaction.type.replace('_', ' ')}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {transaction.description || 'Wallet transaction'} • {format(new Date(transaction.created_at), 'MMM d')}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={`text-sm font-semibold tabular-nums ${amountClass}`}>
                          {formatWalletTransactionAmount(transaction)}
                        </p>
                        <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            transaction.status === 'success' ? 'bg-success'
                            : transaction.status === 'failed' ? 'bg-destructive'
                            : 'bg-warning'
                          }`} />
                          <span className="capitalize">{transaction.status}</span>
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card px-6 py-8 sm:py-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <History className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">No transactions yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Your wallet activity will appear here</p>
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
