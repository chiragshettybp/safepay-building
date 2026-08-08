import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ArrowRight, CheckCircle, Clock, AlertCircle, IndianRupee, Search, Filter, RefreshCw } from 'lucide-react';

interface Refund {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  reason: string;
  created_at: string;
  order?: {
    order_number: string;
    merchant_name: string;
    product_name: string;
  };
}

const statusConfig: Record<string, { color: string; bgColor: string; icon: React.ReactNode; label: string }> = {
  initiated: { 
    color: 'text-warning', 
    bgColor: 'bg-warning/10', 
    icon: <Clock className="w-4 h-4" />,
    label: 'Initiated'
  },
  processing: { 
    color: 'text-primary', 
    bgColor: 'bg-primary/10', 
    icon: <RefreshCw className="w-4 h-4 animate-spin" />,
    label: 'Processing'
  },
  success: { 
    color: 'text-success', 
    bgColor: 'bg-success/10', 
    icon: <CheckCircle className="w-4 h-4" />,
    label: 'Completed'
  },
  failed: { 
    color: 'text-destructive', 
    bgColor: 'bg-destructive/10', 
    icon: <AlertCircle className="w-4 h-4" />,
    label: 'Failed'
  },
};

export default function Refunds() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    const fetchRefunds = async () => {
      if (!user?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('refunds')
          .select(`
            *,
            order:orders(order_number, merchant_name, product_name)
          `)
          .eq('customer_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setRefunds(data || []);
      } catch (error) {
        console.error('Error fetching refunds:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRefunds();

    // Realtime subscription
    const channel = supabase
      .channel('refunds-list')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'refunds'
      }, () => {
        fetchRefunds();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const getRefundRoute = (refund: Refund) => {
    if (refund.status === 'success') return `/refunds/${refund.id}/success`;
    if (refund.status === 'failed') return `/refunds/${refund.id}/failed`;
    return `/refunds/${refund.id}`;
  };

  const filteredRefunds = refunds.filter(refund => {
    const matchesSearch = 
      refund.order?.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      refund.order?.merchant_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      refund.reason.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || refund.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: refunds.reduce((sum, r) => sum + Number(r.amount), 0),
    pending: refunds.filter(r => r.status === 'initiated' || r.status === 'processing').length,
    completed: refunds.filter(r => r.status === 'success').length,
    failed: refunds.filter(r => r.status === 'failed').length,
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-background border-b border-border px-4 py-4">
          <h1 className="text-xl font-bold text-foreground mb-4">Refunds</h1>
          
          {/* Stats */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            <div className="bg-muted/50 rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Total</p>
              <p className="text-sm font-bold text-foreground">₹{stats.total.toLocaleString()}</p>
            </div>
            <div className="bg-warning/10 rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Pending</p>
              <p className="text-sm font-bold text-warning">{stats.pending}</p>
            </div>
            <div className="bg-success/10 rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Completed</p>
              <p className="text-sm font-bold text-success">{stats.completed}</p>
            </div>
            <div className="bg-destructive/10 rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Failed</p>
              <p className="text-sm font-bold text-destructive">{stats.failed}</p>
            </div>
          </div>

          {/* Search & Filter */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search refunds..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All Status</option>
              <option value="initiated">Initiated</option>
              <option value="processing">Processing</option>
              <option value="success">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredRefunds.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <IndianRupee className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">No refunds found</h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery || statusFilter !== 'all' 
                  ? 'Try adjusting your search or filter' 
                  : 'Your refund history will appear here'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRefunds.map((refund) => {
                const status = statusConfig[refund.status] || statusConfig.initiated;
                
                return (
                  <Link
                    key={refund.id}
                    to={getRefundRoute(refund)}
                    className="block bg-card rounded-2xl border border-border p-4 hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full ${status.bgColor} flex items-center justify-center ${status.color}`}>
                          {status.icon}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">
                            ₹{Number(refund.amount).toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {refund.order?.order_number ? `#${refund.order.order_number}` : 'Order'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.bgColor} ${status.color}`}>
                          {status.label}
                        </span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <p className="text-muted-foreground">
                          {refund.order?.merchant_name || 'Merchant'}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {refund.reason.replace(/_/g, ' ')}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(refund.created_at), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </DashboardLayout>
  );
}
