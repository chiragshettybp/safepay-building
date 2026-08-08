import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { 
  Lock, TrendingUp, ArrowUpRight, ArrowDownLeft, Package, CheckCircle, 
  AlertTriangle, Plus, Building, CreditCard, Clock, Shield, ChevronRight,
  Wallet as WalletIcon, RefreshCw, History
} from 'lucide-react';

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
  const navigate = useNavigate();
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
    if (type === 'withdrawal') return <ArrowUpRight className="w-4 h-4 text-destructive" />;
    if (type === 'credit') return <Plus className="w-4 h-4 text-success" />;
    return <WalletIcon className="w-4 h-4 text-primary" />;
  };

  const getStatusColor = (status: string) => {
    if (status === 'success') return 'text-success';
    if (status === 'failed') return 'text-destructive';
    return 'text-warning';
  };

  const maskAccountNumber = (number: string) => {
    return '••••' + number.slice(-4);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mobile-section pb-24">
        <h1 className="text-responsive-xl font-bold text-foreground mb-0.5">Wallet</h1>
        <p className="text-muted-foreground text-responsive-xs mb-4">Manage your balance and bank accounts</p>

        {/* Wallet Balance Card */}
        <div className="bg-gradient-to-br from-primary to-primary/80 rounded-xl sm:rounded-2xl p-4 sm:p-5 text-primary-foreground mb-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-primary-foreground/80 text-[10px] sm:text-xs mb-0.5 sm:mb-1">Available Balance</p>
              <h2 className="text-2xl sm:text-3xl font-bold">
                ₹{(wallet?.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-white/20 rounded-full">
              <Shield className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              <span className="text-[9px] sm:text-[10px] font-medium">Verified</span>
            </div>
          </div>
          <p className="text-primary-foreground/60 text-[10px] sm:text-xs mb-3 sm:mb-4">
            Last updated: {wallet?.last_updated ? format(new Date(wallet.last_updated), 'MMM d, h:mm a') : 'Just now'}
          </p>
          <div className="quick-actions">
            <Link to="/wallet/withdraw" className="contents">
              <Button variant="secondary" className="flex-1 h-10 sm:h-11 bg-white/20 hover:bg-white/30 active:bg-white/40 text-white border-0 rounded-xl text-xs sm:text-sm font-medium">
                <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" />
                Withdraw
              </Button>
            </Link>
            <Link to="/wallet/transactions" className="contents">
              <Button variant="secondary" className="flex-1 h-10 sm:h-11 bg-white/20 hover:bg-white/30 active:bg-white/40 text-white border-0 rounded-xl text-xs sm:text-sm font-medium">
                <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" />
                History
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4">
          <div className="stat-card">
            <div className="flex items-center gap-2 sm:gap-2.5">
              <div className="metric-card-icon bg-success/10">
                <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-success" />
              </div>
              <div className="min-w-0">
                <p className="metric-card-label">Total Refunds</p>
                <p className="text-sm sm:text-base font-bold text-foreground truncate">
                  ₹{stats.totalRefunds.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 sm:gap-2.5">
              <div className="metric-card-icon bg-destructive/10">
                <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-destructive" />
              </div>
              <div className="min-w-0">
                <p className="metric-card-label">Withdrawn</p>
                <p className="text-sm sm:text-base font-bold text-foreground truncate">
                  ₹{stats.totalWithdrawn.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 sm:gap-2.5">
              <div className="metric-card-icon bg-primary/10">
                <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="metric-card-label">In SafePay</p>
                <p className="text-sm sm:text-base font-bold text-foreground truncate">
                  ₹{stats.inEscrow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 sm:gap-2.5">
              <div className="metric-card-icon bg-warning/10">
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-warning" />
              </div>
              <div className="min-w-0">
                <p className="metric-card-label">Pending</p>
                <p className="text-sm sm:text-base font-bold text-foreground truncate">
                  ₹{stats.pendingRefunds.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Linked Bank Accounts */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-foreground">Linked Bank Accounts</h3>
            <Link to="/wallet/bank-account" className="text-primary text-xs font-medium flex items-center gap-1">
              <Plus className="w-3 h-3" />
              Add New
            </Link>
          </div>

          {bankAccounts.length > 0 ? (
            <div className="space-y-2">
              {bankAccounts.map((account) => (
                <Link
                  key={account.id}
                  to={`/wallet/bank-account/${account.id}`}
                  className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:border-primary/30 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Building className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-foreground font-medium text-sm truncate">{account.bank_name}</p>
                      {account.is_default && (
                        <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] font-medium rounded">Default</span>
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {account.account_type} • {maskAccountNumber(account.account_number)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-medium ${
                      account.verification_status === 'verified' 
                        ? 'bg-success/10 text-success' 
                        : 'bg-warning/10 text-warning'
                    }`}>
                      {account.verification_status === 'verified' ? 'Verified' : 'Pending'}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-card border border-border rounded-xl">
              <Building className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-foreground font-medium text-sm">No bank accounts linked</p>
              <p className="text-muted-foreground text-xs mb-4">Add a bank account to receive refunds</p>
              <Link to="/wallet/bank-account">
                <Button size="sm" className="rounded-xl">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add Bank Account
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-foreground">Recent Transactions</h3>
            <Link to="/wallet/transactions" className="text-primary text-xs font-medium">View All</Link>
          </div>

          {recentTransactions.length > 0 ? (
            <div className="space-y-2">
              {recentTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl"
                >
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                    {getTransactionIcon(transaction.type, transaction.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground font-medium text-sm truncate capitalize">
                      {transaction.type.replace('_', ' ')}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {transaction.description || 'Wallet transaction'} • {format(new Date(transaction.created_at), 'MMM d')}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-semibold text-sm ${transaction.type === 'withdrawal' ? 'text-destructive' : 'text-success'}`}>
                      {transaction.type === 'withdrawal' ? '-' : '+'}₹{Number(transaction.amount).toLocaleString('en-IN')}
                    </p>
                    <span className={`text-xs font-medium capitalize ${getStatusColor(transaction.status)}`}>
                      {transaction.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-card border border-border rounded-xl">
              <History className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-foreground font-medium text-sm">No transactions yet</p>
              <p className="text-muted-foreground text-xs">Your wallet activity will appear here</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
