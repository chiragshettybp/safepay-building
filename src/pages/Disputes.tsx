import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface Dispute {
  id: string;
  order_id: string;
  reason: string;
  description: string | null;
  status: string;
  resolution: string | null;
  created_at: string;
  updated_at: string;
  orders?: {
    order_number: string;
    merchant_name: string;
    amount: number;
    currency: string;
  };
}

const statusConfig: Record<string, { color: string; label: string; icon: string }> = {
  open: { color: 'bg-amber-500/10 text-amber-600', label: 'Open', icon: 'pending' },
  under_review: { color: 'bg-blue-500/10 text-blue-600', label: 'Under Review', icon: 'search' },
  info_required: { color: 'bg-orange-500/10 text-orange-600', label: 'Info Required', icon: 'help' },
  escalated: { color: 'bg-purple-500/10 text-purple-600', label: 'Escalated', icon: 'trending_up' },
  resolved: { color: 'bg-emerald-500/10 text-emerald-600', label: 'Resolved', icon: 'check_circle' },
  closed: { color: 'bg-muted text-muted-foreground', label: 'Closed', icon: 'lock' },
  rejected: { color: 'bg-destructive/10 text-destructive', label: 'Rejected', icon: 'cancel' },
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
              <span className="material-symbols-outlined text-foreground">arrow_back</span>
            </button>
            <h1 className="text-base sm:text-lg font-semibold text-foreground truncate">My Disputes</h1>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="px-4 py-3 border-b border-border bg-card">
        {/* Search */}
        <div className="relative mb-3">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg sm:text-xl">
            search
          </span>
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
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredDisputes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon bg-muted">
              <span className="material-symbols-outlined text-muted-foreground text-2xl sm:text-3xl">gavel</span>
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
                    <span className="material-symbols-outlined text-lg sm:text-xl">{statusInfo.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-sm sm:text-base text-foreground truncate">
                          {dispute.orders?.order_number || 'Order'}
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">
                          {dispute.orders?.merchant_name}
                        </p>
                      </div>
                      <span className={`status-badge shrink-0 ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-foreground mt-1 line-clamp-1">
                      {dispute.reason}
                    </p>
                    <div className="flex items-center gap-2 sm:gap-3 mt-1.5 sm:mt-2">
                      <span className="text-[10px] sm:text-xs text-muted-foreground">
                        {format(new Date(dispute.created_at), 'MMM d, yyyy')}
                      </span>
                      {dispute.orders && (
                        <span className="text-[10px] sm:text-xs font-medium text-foreground">
                          {dispute.orders.currency} {dispute.orders.amount}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-muted-foreground shrink-0">chevron_right</span>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
