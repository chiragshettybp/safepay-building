import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { formatWalletTransactionAmount, walletTransactionTone } from '@/lib/format';
import { 
  ArrowLeft, Search, Filter, ArrowUpRight, ArrowDownLeft, 
  Plus, CheckCircle, Clock, AlertCircle, ChevronDown, ChevronUp,
  Wallet, RefreshCw, X
} from 'lucide-react';

interface WalletTransaction {
  id: string;
  public_transaction_id: string;
  public_withdrawal_id: string | null;
  type: string;
  amount: number;
  currency: string;
  description: string | null;
  reference_id: string | null;
  reference_type: string | null;
  status: string;
  metadata: any;
  created_at: string;
}

const typeOptions = [
  { value: 'all', label: 'All Types' },
  { value: 'credit', label: 'Credit' },
  { value: 'debit', label: 'Debit' },
  { value: 'refund', label: 'Refund' },
  { value: 'withdrawal', label: 'Withdrawal' },
];

const statusOptions = [
  { value: 'all', label: 'All Status' },
  { value: 'success', label: 'Success' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
];

export default function WalletTransactions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchTransactions = async () => {
    if (!user?.id) return;

    try {
      // First get wallet
      const { data: wallet } = await supabase
        .from('wallets')
        .select('id')
        .eq('customer_id', user.id)
        .maybeSingle();

      if (!wallet) {
        setTransactions([]);
        setIsLoading(false);
        return;
      }

      let query = supabase
        .from('wallet_transactions')
        .select('*')
        .eq('wallet_id', wallet.id)
        .order('created_at', { ascending: false });

      if (typeFilter !== 'all') {
        query = query.eq('type', typeFilter);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();

    // Realtime subscription
    if (user?.id) {
      const channel = supabase
        .channel('wallet-transactions-realtime')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'wallet_transactions'
        }, () => fetchTransactions())
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user?.id, typeFilter, statusFilter]);

  const filteredTransactions = transactions.filter(t => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      t.public_transaction_id?.toLowerCase().includes(search) ||
      t.public_withdrawal_id?.toLowerCase().includes(search) ||
      t.id.toLowerCase().includes(search) ||
      t.type.toLowerCase().includes(search) ||
      t.description?.toLowerCase().includes(search)
    );
  });

  const getTransactionIcon = (type: string) => {
    if (type === 'refund') return <ArrowDownLeft className="w-5 h-5 text-success" />;
    if (walletTransactionTone(type) === 'debit') return <ArrowUpRight className="w-5 h-5 text-destructive" />;
    if (type === 'credit') return <Plus className="w-5 h-5 text-success" />;
    return <Wallet className="w-5 h-5 text-primary" />;
  };

  const getStatusIcon = (status: string) => {
    if (status === 'success') return <CheckCircle className="w-4 h-4 text-success" />;
    if (status === 'failed') return <AlertCircle className="w-4 h-4 text-destructive" />;
    return <Clock className="w-4 h-4 text-warning" />;
  };

  const getStatusTone = (status: string): 'success' | 'destructive' | 'warning' => {
    if (status === 'success') return 'success';
    if (status === 'failed') return 'destructive';
    return 'warning';
  };

  const clearFilters = () => {
    setTypeFilter('all');
    setStatusFilter('all');
    setSearchQuery('');
  };

  const hasActiveFilters = typeFilter !== 'all' || statusFilter !== 'all' || searchQuery !== '';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b border-border px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => navigate('/wallet')} className="p-2 -ml-2 rounded-full hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-foreground">Wallet Transactions</h1>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 -mr-2 rounded-full hover:bg-muted ${showFilters ? 'bg-primary/10 text-primary' : ''}`}
          >
            <Filter className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-3 p-3 bg-muted/50 rounded-xl space-y-3">
            <SegmentedControl
              options={typeOptions.map(o => ({
                value: o.value,
                label: <span className="text-xs sm:text-sm">{o.label}</span>,
              }))}
              value={typeFilter}
              onChange={setTypeFilter}
              fullWidth
            />
            <SegmentedControl
              options={statusOptions.map(o => ({
                value: o.value,
                label: <span className="text-xs sm:text-sm">{o.label}</span>,
              }))}
              value={statusFilter}
              onChange={setStatusFilter}
              fullWidth
            />
            {hasActiveFilters && (
              <button 
                onClick={clearFilters}
                className="flex items-center gap-1 text-sm text-destructive font-medium press-scale"
              >
                <X className="w-4 h-4" />
                Clear filters
              </button>
            )}
          </div>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Wallet className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">No transactions found</h3>
            <p className="text-sm text-muted-foreground">
              {hasActiveFilters ? 'Try adjusting your filters' : 'Your transaction history will appear here'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTransactions.map((transaction) => (
              <div key={transaction.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                <button
                  onClick={() => setExpandedId(expandedId === transaction.id ? null : transaction.id)}
                  className="w-full p-4 flex items-center gap-3 text-left"
                >
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0">
                    {getTransactionIcon(transaction.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-foreground capitalize">
                        {transaction.type.replace('_', ' ')}
                      </p>
                      <StatusBadge tone={getStatusTone(transaction.status)} label={transaction.status} />
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {transaction.description || 'Wallet transaction'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(transaction.created_at), 'MMM d, yyyy • h:mm a')}
                    </p>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <p className={`text-lg font-bold ${
                      walletTransactionTone(transaction.type) === 'debit' ? 'text-destructive'
                      : walletTransactionTone(transaction.type) === 'credit' ? 'text-success'
                      : 'text-foreground'
                    }`}>
                      {formatWalletTransactionAmount(transaction)}
                    </p>
                    {expandedId === transaction.id ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {/* Expanded Details */}
                {expandedId === transaction.id && (
                  <div className="px-4 pb-4 pt-0 border-t border-border mt-0">
                    <div className="pt-4 space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-border/50">
                        <span className="text-sm text-muted-foreground">Transaction ID</span>
                        <span className="text-sm font-mono text-foreground">{transaction.public_transaction_id || transaction.id.slice(0, 8).toUpperCase()}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-border/50">
                        <span className="text-sm text-muted-foreground">Type</span>
                        <span className="text-sm font-medium text-foreground capitalize">{transaction.type}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-border/50">
                        <span className="text-sm text-muted-foreground">Status</span>
                        <div className="flex items-center gap-1.5">
                          {getStatusIcon(transaction.status)}
                          <span className="text-sm font-medium text-foreground capitalize">{transaction.status}</span>
                        </div>
                      </div>
                      {transaction.reference_type && (
                        <div className="flex justify-between items-center py-2 border-b border-border/50">
                          <span className="text-sm text-muted-foreground">Reference</span>
                          <span className="text-sm font-medium text-foreground capitalize">{transaction.reference_type}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center py-2">
                        <span className="text-sm text-muted-foreground">Date & Time</span>
                        <span className="text-sm font-medium text-foreground">
                          {format(new Date(transaction.created_at), 'MMM d, yyyy h:mm a')}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
