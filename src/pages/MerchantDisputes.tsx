import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
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

interface Dispute {
  id: string;
  order_id: string;
  customer_id: string;
  reason: string;
  description: string | null;
  issue_type: string | null;
  status: string;
  resolution: string | null;
  created_at: string;
  updated_at: string;
  merchant_not_responded: boolean | null;
  order: {
    order_number: string;
    product_name: string;
    amount: number;
  } | null;
  customer_name: string | null;
}

type StatusFilter = 'all' | 'pending' | 'under_review' | 'info_required' | 'resolved' | 'rejected';

export default function MerchantDisputes() {
  const navigate = useNavigate();
  const { merchant, isAuthenticated, isLoading: authLoading } = useMerchantAuth();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);

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

  const fetchDisputes = useCallback(async () => {
    if (!merchant?.id) return;

    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, order_number, product_name, amount, customer_id')
        .eq('merchant_id', merchant.id);

      if (ordersError) throw ordersError;

      if (!ordersData || ordersData.length === 0) {
        setDisputes([]);
        setIsLoading(false);
        return;
      }

      const orderIds = ordersData.map(o => o.id);
      const orderMap = new Map(ordersData.map(o => [o.id, o]));

      const { data: disputesData, error: disputesError } = await supabase
        .from('disputes')
        .select('*')
        .in('order_id', orderIds)
        .order('created_at', { ascending: false });

      if (disputesError) throw disputesError;

      const customerIds = [...new Set((disputesData || []).map(d => d.customer_id))];
      const { data: customersData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', customerIds);

      const customerMap = new Map((customersData || []).map(c => [c.id, c.full_name]));

      const mappedDisputes: Dispute[] = (disputesData || []).map((d: any) => ({
        ...d,
        order: orderMap.get(d.order_id) ? {
          order_number: orderMap.get(d.order_id)!.order_number,
          product_name: orderMap.get(d.order_id)!.product_name,
          amount: orderMap.get(d.order_id)!.amount,
        } : null,
        customer_name: customerMap.get(d.customer_id) || 'Unknown',
      }));

      setDisputes(mappedDisputes);
    } catch (error) {
      console.error('Error fetching disputes:', error);
      toast.error('Failed to load disputes');
    } finally {
      setIsLoading(false);
    }
  }, [merchant?.id]);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  useEffect(() => {
    if (!merchant?.id) return;

    const channel = supabase
      .channel('merchant-disputes-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'disputes' }, () => fetchDisputes())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dispute_comments' }, () => fetchDisputes())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [merchant?.id, fetchDisputes]);

  const getStatusConfig = (status: string): { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string } => {
    const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      pending: { variant: 'secondary', label: 'Pending' },
      under_review: { variant: 'default', label: 'Reviewing' },
      info_required: { variant: 'destructive', label: 'Info Needed' },
      escalated: { variant: 'destructive', label: 'Escalated' },
      resolved: { variant: 'outline', label: 'Resolved' },
      closed: { variant: 'outline', label: 'Closed' },
      rejected: { variant: 'outline', label: 'Rejected' },
    };
    return config[status] || { variant: 'secondary', label: status };
  };

  const filteredDisputes = disputes.filter((dispute) => {
    const matchesSearch =
      dispute.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (dispute.order?.order_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (dispute.customer_name || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (statusFilter === 'all') return matchesSearch;
    return matchesSearch && dispute.status === statusFilter;
  });

  const urgentDisputes = disputes.filter(d => 
    d.status === 'pending' || d.status === 'info_required' || d.merchant_not_responded
  );

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(dateString).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  if (authLoading || !isAuthenticated || !merchant) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0"
      />

      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border safe-top">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/merchant-dashboard')} className="p-2 -ml-2 hover:bg-muted rounded-full touch-target">
              <span className="material-symbols-outlined text-xl">arrow_back</span>
            </button>
            <h1 className="text-lg font-semibold text-foreground">Disputes</h1>
            {urgentDisputes.length > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5">{urgentDisputes.length}</Badge>
            )}
          </div>
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger asChild>
              <button className="p-2 hover:bg-muted rounded-full touch-target lg:hidden">
                <span className="material-symbols-outlined text-xl">filter_list</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-auto rounded-t-2xl">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <div className="py-4 space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Status</label>
                  <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as StatusFilter); setFiltersOpen(false); }}>
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Disputes</SelectItem>
                      <SelectItem value="pending">Pending Response</SelectItem>
                      <SelectItem value="under_review">Under Review</SelectItem>
                      <SelectItem value="info_required">Info Required</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        <div className="px-4 py-4">
          {/* Urgent Alert */}
          {urgentDisputes.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 mb-4">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-destructive text-lg">warning</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-destructive">Action Required</p>
                  <p className="text-[11px] text-destructive/80">
                    {urgentDisputes.length} dispute{urgentDisputes.length > 1 ? 's' : ''} need your response
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Search */}
          <div className="relative mb-3">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">
              search
            </span>
            <Input
              type="text"
              placeholder="Search disputes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 text-sm"
            />
          </div>

          {/* Status Pills */}
          <div className="flex gap-2 overflow-x-auto pb-3 mb-3 -mx-4 px-4 scrollbar-hide">
            {(['all', 'pending', 'under_review', 'resolved'] as StatusFilter[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all active:scale-95 ${
                  statusFilter === filter
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {filter === 'all' ? 'All' : filter === 'under_review' ? 'Reviewing' : filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>

          {/* Disputes List */}
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-muted/30 rounded-xl p-3">
                  <Skeleton className="h-4 w-28 mb-1.5" />
                  <Skeleton className="h-3 w-40 mb-1.5" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          ) : filteredDisputes.length === 0 ? (
            <div className="bg-muted/30 rounded-xl p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                <span className="material-symbols-outlined text-muted-foreground text-2xl">gavel</span>
              </div>
              <h3 className="text-sm font-medium text-foreground mb-1">No disputes found</h3>
              <p className="text-xs text-muted-foreground">
                {searchQuery || statusFilter !== 'all' ? 'Try different filters' : 'Disputes will appear here'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredDisputes.map((dispute) => {
                const statusConfig = getStatusConfig(dispute.status);
                const isUrgent = dispute.status === 'pending' || dispute.status === 'info_required' || dispute.merchant_not_responded;
                
                return (
                  <div
                    key={dispute.id}
                    className={`bg-muted/30 rounded-xl p-3 active:bg-muted/50 transition-colors ${isUrgent ? 'border-l-3 border-l-destructive' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-foreground">
                            #{dispute.id.slice(0, 8)}
                          </p>
                          {isUrgent && (
                            <span className="material-symbols-outlined text-xs text-destructive">priority_high</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          Order #{dispute.order?.order_number || 'N/A'}
                        </p>
                      </div>
                      <Badge variant={statusConfig.variant} className="text-[10px] px-1.5 py-0.5 flex-shrink-0">
                        {statusConfig.label}
                      </Badge>
                    </div>

                    <div className="space-y-1 mb-2">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{dispute.customer_name}</span> • {dispute.issue_type || dispute.reason}
                      </p>
                      {dispute.order && (
                        <p className="text-xs font-semibold text-foreground">{formatAmount(dispute.order.amount)}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">{getTimeAgo(dispute.updated_at)}</span>
                      
                      <div className="flex gap-2">
                        {(dispute.status === 'pending' || dispute.status === 'info_required') ? (
                          <Link to={`/merchant-dispute-response/${dispute.id}`}>
                            <Button size="sm" className="h-7 text-xs px-2.5">
                              <span className="material-symbols-outlined text-sm mr-1">reply</span>
                              Respond
                            </Button>
                          </Link>
                        ) : dispute.status === 'resolved' || dispute.status === 'closed' ? (
                          <Link to={`/merchant-dispute-result/${dispute.id}`}>
                            <Button size="sm" variant="outline" className="h-7 text-xs px-2.5">
                              <span className="material-symbols-outlined text-sm mr-1">description</span>
                              Result
                            </Button>
                          </Link>
                        ) : (
                          <Link to={`/merchant-dispute-response/${dispute.id}`}>
                            <Button size="sm" variant="outline" className="h-7 text-xs px-2.5">
                              <span className="material-symbols-outlined text-sm mr-1">visibility</span>
                              View
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
          <Link to="/merchant-disputes" className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 text-primary touch-target">
            <span className="material-symbols-outlined text-xl">gavel</span>
            <span className="text-[10px] font-medium">Disputes</span>
          </Link>
          <Link to="/merchant-payouts" className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 text-muted-foreground touch-target">
            <span className="material-symbols-outlined text-xl">account_balance_wallet</span>
            <span className="text-[10px]">Payouts</span>
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
