import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Hourglass,
  Lock,
  Scale,
  Search,
  TrendingUp,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

interface Dispute {
  id: string;
  public_dispute_id: string;
  order_id: string;
  reason: string;
  description: string | null;
  status: string;
  resolution: string | null;
  created_at: string;
  updated_at: string;
  orders?: {
    public_order_id: string;
    order_number: string;
    merchant_name: string;
    amount: number;
    currency: string;
  };
}

const statusConfig: Record<string, { color: string; label: string; icon: LucideIcon; tone: 'success' | 'warning' | 'destructive' | 'info' | 'neutral' }> = {
  open: { color: 'bg-amber-500/10 text-amber-600', label: 'Open', icon: Hourglass, tone: 'warning' },
  under_review: { color: 'bg-blue-500/10 text-blue-600', label: 'Under Review', icon: Search, tone: 'info' },
  info_required: { color: 'bg-orange-500/10 text-orange-600', label: 'Info Required', icon: CircleHelp, tone: 'warning' },
  escalated: { color: 'bg-purple-500/10 text-purple-600', label: 'Escalated', icon: TrendingUp, tone: 'neutral' },
  resolved: { color: 'bg-emerald-500/10 text-emerald-600', label: 'Resolved', icon: CheckCircle2, tone: 'success' },
  closed: { color: 'bg-muted text-muted-foreground', label: 'Closed', icon: Lock, tone: 'neutral' },
  rejected: { color: 'bg-destructive/10 text-destructive', label: 'Rejected', icon: XCircle, tone: 'destructive' },
};

const filterOptions = [
  { value: 'all', label: 'All Disputes' },
  { value: 'open', label: 'Open' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'info_required', label: 'Info Required' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

export default function Disputes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!user?.id) {
      navigate('/customer-login');
      return;
    }

    fetchDisputes();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('disputes-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'disputes',
          filter: `customer_id=eq.${user.id}`,
        },
        () => {
          fetchDisputes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const fetchDisputes = async () => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from('disputes')
      .select(`
        *,
        orders (
          public_order_id,
          order_number,
          merchant_name,
          amount,
          currency
        )
      `)
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching disputes:', error);
    } else {
      setDisputes(data || []);
    }
    setIsLoading(false);
  };

  const filteredDisputes = disputes.filter(dispute => {
    const matchesFilter = filter === 'all' || dispute.status === filter;
    const matchesSearch = searchQuery === '' || 
      dispute.public_dispute_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dispute.orders?.public_order_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dispute.orders?.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dispute.orders?.merchant_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dispute.reason?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getStatusInfo = (status: string) => {
    return statusConfig[status] || statusConfig.open;
  };

  return (
    <div className="mobile-page">
      {/* Header */}
      <header className="sticky-header bg-card">
        <div className="sticky-header-content">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => navigate(-1)}
              className="back-btn"
            >
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
            <h1 className="text-base sm:text-lg font-semibold text-foreground truncate">My Disputes</h1>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="px-4 py-3 border-b border-border bg-card">
        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-[18px] w-[18px] sm:h-5 sm:w-5" />
          <input
            type="text"
            placeholder="Search disputes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mobile-input w-full pl-10 pr-4"
          />
        </div>

        {/* Status Filter Chips */}
        <div className="horizontal-scroll -mx-4 px-4">
          <div className="horizontal-scroll-content">
            {filterOptions.map(option => (
              <button
                key={option.value}
                onClick={() => setFilter(option.value)}
                className={`filter-chip ${
                  filter === option.value ? 'filter-chip-active' : 'filter-chip-inactive'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="pb-20">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner className="h-8 w-8" />
          </div>
        ) : filteredDisputes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon bg-muted">
              <Scale className="text-muted-foreground h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <h2 className="text-base sm:text-lg font-semibold text-foreground mb-1">No disputes found</h2>
            <p className="text-muted-foreground text-xs sm:text-sm">
              {filter !== 'all' ? 'No disputes match your filter.' : "You haven't raised any disputes yet."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredDisputes.map(dispute => {
              const statusInfo = getStatusInfo(dispute.status);
              return (
                <Link
                  key={dispute.id}
                  to={`/disputes/${dispute.id}`}
                  className="item-row"
                >
                  <div className={`item-avatar ${statusInfo.color}`}>
                    <statusInfo.icon className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-sm sm:text-base text-foreground truncate">
                          {dispute.public_dispute_id || dispute.orders?.order_number || 'Dispute'}
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">
                          {dispute.orders?.merchant_name}
                        </p>
                      </div>
                      <StatusBadge tone={statusInfo.tone} label={statusInfo.label} />
                    </div>
                    <p className="text-xs sm:text-sm text-foreground mt-1 line-clamp-1">
                      {dispute.reason}
                    </p>
                    <div className="flex items-center gap-2 sm:gap-3 mt-1.5 sm:mt-2">
                      <span className="text-[10px] sm:text-xs text-muted-foreground">
                        {format(new Date(dispute.created_at), 'MMM d, yyyy')}
                      </span>
                      {dispute.orders?.public_order_id && (
                        <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">
                          {dispute.orders.public_order_id}
                        </span>
                      )}
                      {dispute.orders && (
                        <span className="text-[10px] sm:text-xs font-medium text-foreground">
                          {dispute.orders.currency} {dispute.orders.amount}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="text-muted-foreground shrink-0 h-5 w-5" />
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
