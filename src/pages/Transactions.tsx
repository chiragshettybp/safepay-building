import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format, startOfDay, endOfDay, subDays, subMonths, isWithinInterval } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatAmount } from '@/lib/format';
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleX,
  Clock,
  Plus,
  ReceiptText,
  Search,
} from 'lucide-react';

interface Transaction {
  id: string;
  public_transaction_id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
}

type DateRange = { from: Date | undefined; to?: Date | undefined };

export default function Transactions() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [datePreset, setDatePreset] = useState<string>('all');

  const applyDatePreset = (preset: string) => {
    setDatePreset(preset);
    const today = new Date();
    switch (preset) {
      case 'today':
        setDateRange({ from: startOfDay(today), to: endOfDay(today) });
        break;
      case 'last7':
        setDateRange({ from: startOfDay(subDays(today, 7)), to: endOfDay(today) });
        break;
      case 'last30':
        setDateRange({ from: startOfDay(subDays(today, 30)), to: endOfDay(today) });
        break;
      case 'last3months':
        setDateRange({ from: startOfDay(subMonths(today, 3)), to: endOfDay(today) });
        break;
      case 'all':
      default:
        setDateRange({ from: undefined, to: undefined });
        break;
    }
  };

  useEffect(() => {
    if (!user?.id) return;

    const fetchTransactions = async () => {
      setIsLoading(true);
      try {
        let query = supabase
          .from('payment_transactions')
          .select('*')
          .eq('customer_id', user.id)
          .order('created_at', { ascending: false });

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

    fetchTransactions();

    const channel = supabase
      .channel('transactions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payment_transactions',
          filter: `customer_id=eq.${user.id}`,
        },
        () => fetchTransactions()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, statusFilter]);

  const filteredTransactions = transactions.filter((tx) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        tx.public_transaction_id?.toLowerCase().includes(query) ||
        tx.razorpay_payment_id?.toLowerCase().includes(query) ||
        tx.razorpay_order_id?.toLowerCase().includes(query) ||
        tx.customer_name?.toLowerCase().includes(query) ||
        tx.id.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Date range filter
    if (dateRange.from || dateRange.to) {
      const txDate = new Date(tx.created_at);
      const from = dateRange.from || new Date(0);
      const to = dateRange.to || new Date();
      if (!isWithinInterval(txDate, { start: startOfDay(from), end: endOfDay(to) })) {
        return false;
      }
    }

    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <StatusBadge tone="success" label="Success" />;
      case 'failed':
        return <StatusBadge tone="destructive" label="Failed" />;
      case 'pending':
        return <StatusBadge tone="neutral" label="Pending" />;
      default:
        return <StatusBadge tone="neutral" label={status} />;
    }
  };

  return (
    <DashboardLayout>
      <div className="w-full max-w-4xl mx-auto px-4 py-4 sm:py-6 pb-24">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Transactions</h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-0.5 sm:mt-1">View all your payment transactions</p>
          </div>
          <Link to="/payment/new" className="self-start sm:self-auto">
            <Button size="sm" className="h-9 sm:h-10 rounded-xl text-xs sm:text-sm">
              <Plus className="h-4 w-4 sm:h-[18px] sm:w-[18px] mr-1.5" />
              New Payment
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 mb-4 sm:mb-6">
          {/* Search and Status */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <Search className="h-[18px] w-[18px] sm:h-[20px] sm:w-[20px]" />
              </span>
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 sm:pl-10 h-10 sm:h-11 text-sm rounded-xl"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[100px] sm:w-[140px] h-10 sm:h-11 rounded-xl text-xs sm:text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-card">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Range Filters - Horizontal scroll on mobile */}
          <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
            <div className="flex items-center gap-2 min-w-max">
              <span className="text-xs sm:text-sm text-muted-foreground shrink-0">Date:</span>
              {[
                { value: 'all', label: 'All' },
                { value: 'today', label: 'Today' },
                { value: 'last7', label: '7 Days' },
                { value: 'last30', label: '30 Days' },
                { value: 'last3months', label: '3 Months' },
              ].map((preset) => (
                <Button
                  key={preset.value}
                  variant={datePreset === preset.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => applyDatePreset(preset.value)}
                  className="h-7 sm:h-8 text-[10px] sm:text-xs px-2 sm:px-3 rounded-lg shrink-0"
                >
                  {preset.label}
                </Button>
              ))}
              
              {/* Custom Date Range Picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={datePreset === 'custom' ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 sm:h-8 text-[10px] sm:text-xs px-2 sm:px-3 rounded-lg shrink-0"
                  >
                    <CalendarDays className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" />
                    {datePreset === 'custom' && dateRange.from ? (
                      dateRange.to ? (
                        `${format(dateRange.from, 'M/d')} - ${format(dateRange.to, 'M/d')}`
                      ) : (
                        format(dateRange.from, 'M/d')
                      )
                    ) : (
                      'Custom'
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-card" align="start">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={(range) => {
                      setDateRange(range || { from: undefined, to: undefined });
                      if (range?.from) setDatePreset('custom');
                    }}
                    numberOfMonths={1}
                    className={cn("p-3 pointer-events-auto")}
                    disabled={(date) => date > new Date()}
                  />
                  {dateRange.from && (
                    <div className="p-3 pt-0 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDateRange({ from: undefined, to: undefined });
                          setDatePreset('all');
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* Transactions List */}
        {isLoading ? (
          <div className="space-y-2 sm:space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-card rounded-xl border border-border p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24 sm:w-32" />
                    <Skeleton className="h-3 w-32 sm:w-48" />
                  </div>
                  <div className="text-right space-y-2">
                    <Skeleton className="h-5 w-16 sm:w-20 ml-auto" />
                    <Skeleton className="h-3 w-12 sm:w-16 ml-auto" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-6 sm:p-8 text-center">
            <ReceiptText className="text-muted-foreground h-[40px] w-[40px] sm:h-[48px] sm:w-[48px] mb-3 sm:mb-4" />
            <h3 className="text-foreground font-semibold text-sm sm:text-base mb-1.5 sm:mb-2">No transactions found</h3>
            <p className="text-muted-foreground text-xs sm:text-sm mb-3 sm:mb-4">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Start by making your first payment'}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <Link to="/payment/new">
                <Button size="sm" className="rounded-xl">Make a Payment</Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {filteredTransactions.map((tx) => (
              <Link
                key={tx.id}
                to={`/transactions/${tx.id}`}
                className="flex items-center gap-3 bg-card rounded-xl border border-border p-3 sm:p-4 hover:border-primary/30 active:bg-muted/50 transition-all"
              >
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                  {(() => {
                    const TxnIcon = tx.status === 'success' ? CheckCircle2 : tx.status === 'failed' ? CircleX : Clock;
                    return <TxnIcon className={`h-[18px] w-[18px] ${
                      tx.status === 'success' ? 'text-success' : 
                      tx.status === 'failed' ? 'text-destructive' : 'text-warning'
                    }`} />;
                  })()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5">
                    <span className="text-xs sm:text-sm font-semibold text-foreground truncate font-mono">
                      {tx.public_transaction_id || tx.razorpay_payment_id?.slice(-8) || tx.id.slice(0, 8)}
                    </span>
                    {getStatusBadge(tx.status)}
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                    {tx.customer_name || tx.customer_phone} • {format(new Date(tx.created_at), 'MMM d, h:mm a')}
                  </p>
                </div>
                <div className="text-right shrink-0 flex items-center gap-1">
                  <div>
                    <p className="text-sm sm:text-base font-bold text-foreground">
                      {formatAmount(tx.amount, tx.currency)}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 sm:h-[18px] sm:w-[18px] text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
