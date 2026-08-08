import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface Payout {
  id: string;
  public_payout_id: string;
  amount: number;
  currency: string;
  status: string;
  transaction_id: string | null;
  notes: string | null;
  failure_reason: string | null;
  created_at: string;
  completed_at: string | null;
  wallet_transactions: {
    public_withdrawal_id: string | null;
  } | null;
  bank_account: {
    bank_name: string;
    account_number: string;
  } | null;
}

type StatusFilter = 'all' | 'processing' | 'completed' | 'failed' | 'pending';

export default function MerchantPayoutHistory() {
  const navigate = useNavigate();
  const { merchant, isAuthenticated, isLoading: authLoading } = useMerchantAuth();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [filteredPayouts, setFilteredPayouts] = useState<Payout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/merchant-login', { replace: true });
    }
    if (!authLoading && merchant && merchant.verificationStatus !== 'approved') {
      navigate('/merchant-verify', { replace: true });
    }
  }, [merchant, isAuthenticated, authLoading, navigate]);

  const fetchPayouts = useCallback(async () => {
    if (!merchant?.id) return;

    try {
      setIsLoading(true);

      const { data, error } = await supabase
        .from('merchant_payouts')
        .select(`
          id,
          public_payout_id,
          amount,
          currency,
          status,
          transaction_id,
          notes,
          failure_reason,
          created_at,
          completed_at,
          wallet_transactions (
            public_withdrawal_id
          ),
          merchant_bank_accounts (
            bank_name,
            account_number
          )
        `)
        .eq('merchant_id', merchant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const formattedPayouts = data.map((p: any) => ({
          ...p,
          bank_account: p.merchant_bank_accounts
        }));
        setPayouts(formattedPayouts);
        setFilteredPayouts(formattedPayouts);
      }
    } catch (error) {
      console.error('Error fetching payouts:', error);
      toast.error('Failed to load payout history');
    } finally {
      setIsLoading(false);
    }
  }, [merchant?.id]);

  useEffect(() => {
    if (merchant?.id) {
      fetchPayouts();
    }
  }, [merchant?.id, fetchPayouts]);

  // Realtime subscription
  useEffect(() => {
    if (!merchant?.id) return;

    const channel = supabase
      .channel('payout-history-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'merchant_payouts',
          filter: `merchant_id=eq.${merchant.id}`
        },
        () => fetchPayouts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [merchant?.id, fetchPayouts]);

  // Filter payouts
  useEffect(() => {
    let filtered = [...payouts];

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.public_payout_id?.toLowerCase().includes(query) ||
        p.wallet_transactions?.public_withdrawal_id?.toLowerCase().includes(query) ||
        p.transaction_id?.toLowerCase().includes(query) ||
        p.amount.toString().includes(query) ||
        p.bank_account?.bank_name.toLowerCase().includes(query)
      );
    }

    setFilteredPayouts(filtered);
  }, [payouts, statusFilter, searchQuery]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30';
      case 'processing': return 'bg-amber-500/15 text-amber-600 border-amber-500/30';
      case 'pending': return 'bg-blue-500/15 text-blue-600 border-blue-500/30';
      case 'failed': return 'bg-red-500/15 text-red-600 border-red-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return 'check_circle';
      case 'processing': return 'schedule';
      case 'pending': return 'hourglass_empty';
      case 'failed': return 'cancel';
      default: return 'help';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const statusCounts = {
    all: payouts.length,
    processing: payouts.filter(p => p.status === 'processing').length,
    completed: payouts.filter(p => p.status === 'completed').length,
    failed: payouts.filter(p => p.status === 'failed').length,
    pending: payouts.filter(p => p.status === 'pending').length,
  };

  const totalWithdrawn = payouts
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setIsFilterOpen(false);
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border">
          <div className="flex items-center h-14 px-4">
            <Skeleton className="h-6 w-32" />
          </div>
        </header>
        <main className="p-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
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
            <button onClick={() => navigate('/merchant-payouts')} className="p-1.5 -ml-1.5 rounded-lg hover:bg-muted">
              <span className="material-symbols-outlined text-xl">arrow_back</span>
            </button>
            <div>
              <h1 className="text-lg font-semibold">Payout History</h1>
              <p className="text-[10px] text-muted-foreground">{payouts.length} transactions</p>
            </div>
          </div>
          <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <SheetTrigger asChild>
              <button className="relative p-2 rounded-lg hover:bg-muted">
                <span className="material-symbols-outlined text-xl">filter_list</span>
                {statusFilter !== 'all' && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
                )}
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl">
              <SheetHeader className="pb-4">
                <SheetTitle>Filter Payouts</SheetTitle>
              </SheetHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium">Status</label>
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                    <SelectTrigger className="h-12 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All ({statusCounts.all})</SelectItem>
                      <SelectItem value="processing">Processing ({statusCounts.processing})</SelectItem>
                      <SelectItem value="completed">Completed ({statusCounts.completed})</SelectItem>
                      <SelectItem value="failed">Failed ({statusCounts.failed})</SelectItem>
                      <SelectItem value="pending">Pending ({statusCounts.pending})</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={clearFilters} className="flex-1 h-12 rounded-xl">
                    Clear
                  </Button>
                  <Button onClick={() => setIsFilterOpen(false)} className="flex-1 h-12 rounded-xl">
                    Apply
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">search</span>
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ID, amount, bank..."
              className="pl-10 h-10 rounded-xl text-sm"
            />
          </div>
        </div>

        {/* Status Pills */}
        <div className="px-4 pb-3 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2">
            {(['all', 'processing', 'completed', 'failed'] as StatusFilter[]).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  statusFilter === status
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                <span className="ml-1 opacity-70">({statusCounts[status]})</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Summary Card */}
        <div className="bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Total Withdrawn</p>
              <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalWithdrawn)}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl text-emerald-600">payments</span>
            </div>
          </div>
        </div>

        {/* Payouts List */}
        {filteredPayouts.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl text-muted-foreground">receipt_long</span>
            </div>
            <h3 className="text-base font-semibold mb-1">No Payouts Found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Your payout history will appear here'}
            </p>
            {(searchQuery || statusFilter !== 'all') && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPayouts.map((payout) => (
              <div
                key={payout.id}
                className="bg-card border border-border rounded-xl p-3 active:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      payout.status === 'completed' ? 'bg-emerald-500/15' :
                      payout.status === 'failed' ? 'bg-red-500/15' : 'bg-amber-500/15'
                    }`}>
                      <span className={`material-symbols-outlined text-lg ${
                        payout.status === 'completed' ? 'text-emerald-600' :
                        payout.status === 'failed' ? 'text-red-600' : 'text-amber-600'
                      }`}>
                        {getStatusIcon(payout.status)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-base font-semibold">{formatCurrency(payout.amount)}</span>
                        <Badge className={`${getStatusColor(payout.status)} text-[9px] capitalize`}>
                          {payout.status}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {payout.bank_account ? (
                          <>
                            {payout.bank_account.bank_name} • ****{payout.bank_account.account_number.slice(-4)}
                          </>
                        ) : (
                          'Bank account deleted'
                        )}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(payout.created_at), 'dd MMM yyyy, HH:mm')}
                      </p>
                      <p className="text-[9px] font-mono text-muted-foreground mt-1">
                        {payout.public_payout_id || 'Payout'}
                      </p>
                      {payout.wallet_transactions?.public_withdrawal_id && (
                        <p className="text-[9px] font-mono text-muted-foreground">
                          {payout.wallet_transactions.public_withdrawal_id}
                        </p>
                      )}
                      {payout.failure_reason && (
                        <p className="text-[10px] text-red-600 mt-1">
                          Failed: {payout.failure_reason}
                        </p>
                      )}
                    </div>
                  </div>
                  {payout.status === 'completed' && (
                    <span className="material-symbols-outlined text-lg text-muted-foreground">chevron_right</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-20 safe-bottom">
        <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
          <Link to="/merchant-dashboard" className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 text-muted-foreground touch-target">
            <span className="material-symbols-outlined text-xl">dashboard</span>
            <span className="text-[10px]">Home</span>
          </Link>
          <Link to="/merchant-orders" className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 text-muted-foreground touch-target">
            <span className="material-symbols-outlined text-xl">orders</span>
            <span className="text-[10px]">Orders</span>
          </Link>
          <Link to="/merchant-disputes" className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 text-muted-foreground touch-target">
            <span className="material-symbols-outlined text-xl">gavel</span>
            <span className="text-[10px]">Disputes</span>
          </Link>
          <Link to="/merchant-payouts" className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 text-primary touch-target">
            <span className="material-symbols-outlined text-xl">account_balance_wallet</span>
            <span className="text-[10px] font-medium">Payouts</span>
          </Link>
          <Link to="/merchant-profile" className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 text-muted-foreground touch-target">
            <span className="material-symbols-outlined text-xl">person</span>
            <span className="text-[10px]">Profile</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}