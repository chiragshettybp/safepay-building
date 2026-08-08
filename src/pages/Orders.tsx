import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ArrowLeft, Search, ShoppingBag, Truck, Gavel, ChevronRight, CheckCircle, Flag, AlertTriangle } from 'lucide-react';

interface Order {
  id: string;
  order_number: string;
  merchant_name: string;
  merchant_avatar: string | null;
  product_name: string;
  amount: number;
  currency: string;
  status: string;
  escrow_status: string;
  created_at: string;
}

interface OrderMetrics {
  total: number;
  pending: number;
  disputed: number;
}

const statusConfig: Record<string, { color: string; label: string; bgColor: string; icon?: React.ReactNode }> = {
  pending: { color: 'text-primary', label: 'In SafePay', bgColor: 'bg-primary/10' },
  awaiting_shipment: { color: 'text-primary', label: 'In SafePay', bgColor: 'bg-primary/10' },
  shipped: { color: 'text-warning', label: 'Shipped', bgColor: 'bg-warning/10', icon: <Truck className="w-3.5 h-3.5" /> },
  delivered: { color: 'text-warning', label: 'Delivered', bgColor: 'bg-warning/10' },
  completed: { color: 'text-success', label: 'Released', bgColor: 'bg-success/10', icon: <CheckCircle className="w-3.5 h-3.5" /> },
  disputed: { color: 'text-destructive', label: 'Disputed', bgColor: 'bg-destructive/10', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  refunded: { color: 'text-destructive', label: 'Refunded', bgColor: 'bg-destructive/10' },
  cancelled: { color: 'text-muted-foreground', label: 'Cancelled', bgColor: 'bg-muted' },
};

const statusFilters = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'escrow', label: 'In SafePay' },
  { value: 'completed', label: 'Completed' },
];

export default function Orders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [metrics, setMetrics] = useState<OrderMetrics>({ total: 0, pending: 0, disputed: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user?.id) return;

      try {
        // First fetch ALL orders for metrics (unfiltered)
        const { data: allOrdersData, error: allError } = await supabase
          .from('orders')
          .select('*')
          .eq('customer_id', user.id)
          .order('created_at', { ascending: false });

        if (allError) throw allError;
        
        const allOrders = allOrdersData || [];
        
        // Calculate metrics from ALL orders
        const total = allOrders.length;
        const pending = allOrders.filter(o => ['pending', 'awaiting_shipment', 'shipped', 'delivered'].includes(o.status)).length;
        const disputed = allOrders.filter(o => o.status === 'disputed').length;
        setMetrics({ total, pending, disputed });

        // Apply filter for display
        let filteredOrders = allOrders;
        if (statusFilter === 'pending') {
          filteredOrders = allOrders.filter(o => ['pending', 'awaiting_shipment', 'shipped', 'delivered'].includes(o.status));
        } else if (statusFilter === 'escrow') {
          filteredOrders = allOrders.filter(o => o.escrow_status === 'held');
        } else if (statusFilter === 'completed') {
          filteredOrders = allOrders.filter(o => o.status === 'completed');
        }

        setOrders(filteredOrders);
      } catch (error) {
        console.error('Error fetching orders:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();

    const channel = supabase
      .channel('orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `customer_id=eq.${user?.id}` }, () => fetchOrders())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, statusFilter]);

  return (
    <div className="mobile-page flex flex-col">
      {/* Header */}
      <header className="sticky-header">
        <div className="sticky-header-content">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button onClick={() => navigate('/dashboard')} className="back-btn">
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <h1 className="text-base sm:text-lg font-bold text-foreground truncate">My Orders</h1>
          </div>
          <button className="p-2 rounded-full hover:bg-muted shrink-0">
            <Search className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
      </header>

      {/* Metrics - Horizontal Scroll */}
      <div className="horizontal-scroll py-3 sm:py-4">
        <div className="horizontal-scroll-content">
          <div className="metric-card">
            <div className="flex items-center justify-between mb-2">
              <span className="metric-card-label">Total</span>
              <ShoppingBag className="w-4 h-4 text-primary" />
            </div>
            <p className="metric-card-value">{metrics.total}</p>
          </div>
          <div className="metric-card">
            <div className="flex items-center justify-between mb-2">
              <span className="metric-card-label">Pending</span>
              <Truck className="w-4 h-4 text-warning" />
            </div>
            <p className="metric-card-value">{metrics.pending}</p>
          </div>
          <div className="metric-card">
            <div className="flex items-center justify-between mb-2">
              <span className="metric-card-label">Disputed</span>
              <Gavel className="w-4 h-4 text-destructive" />
            </div>
            <p className="metric-card-value">{metrics.disputed}</p>
          </div>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="horizontal-scroll border-b border-border pb-3">
        <div className="horizontal-scroll-content">
          {statusFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              className={`filter-chip ${
                statusFilter === filter.value ? 'filter-chip-active' : 'filter-chip-inactive'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      <div className="flex-1 overflow-y-auto pb-28 sm:pb-32">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : orders.length > 0 ? (
          <div className="divide-y divide-border">
            {orders.map((order) => (
              <Link
                key={order.id}
                to={`/orders/${order.id}`}
                className="item-row"
              >
                <div className="item-avatar">
                  {order.merchant_avatar ? (
                    <img src={order.merchant_avatar} alt={order.merchant_name} className="w-full h-full object-cover" />
                  ) : (
                    <ShoppingBag className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <p className="font-medium text-sm sm:text-base text-foreground truncate max-w-[140px] sm:max-w-none">{order.product_name}</p>
                    <span className={`status-badge ${statusConfig[order.status]?.bgColor} ${statusConfig[order.status]?.color}`}>
                      {statusConfig[order.status]?.icon}
                      {statusConfig[order.status]?.label}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">{order.merchant_name}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{format(new Date(order.created_at), 'MMM d, yyyy')}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-sm sm:text-base text-foreground">
                    {order.currency === 'USD' ? '$' : '₹'}{Number(order.amount).toLocaleString()}
                  </p>
                  <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto mt-1" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              <ShoppingBag className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
            </div>
            <p className="font-medium text-foreground mb-1 text-sm sm:text-base">No orders yet</p>
            <p className="text-xs sm:text-sm text-muted-foreground mb-4">Start shopping with Safepay protection</p>
            <Link to="/payment/new" className="text-sm font-medium text-primary">
              Make a Payment →
            </Link>
          </div>
        )}
      </div>

      {/* Bottom Action Bar */}
      <div className="bottom-action">
        <div className="quick-actions max-w-lg mx-auto">
          <button
            onClick={() => {
              const order = orders.find(o => o.status === 'delivered');
              if (order) navigate(`/orders/${order.id}/confirm`);
            }}
            className="quick-action-btn bg-primary text-primary-foreground shadow-sm"
          >
            <CheckCircle className="w-4 h-4" />
            <span className="truncate">Confirm Receipt</span>
          </button>
          <button
            onClick={() => {
              const order = orders.find(o => ['pending', 'shipped', 'delivered'].includes(o.status));
              if (order) navigate(`/orders/${order.id}/report`);
            }}
            className="quick-action-btn bg-destructive/10 text-destructive"
          >
            <Flag className="w-4 h-4" />
            <span className="truncate">Report Issue</span>
          </button>
        </div>
      </div>
    </div>
  );
}
