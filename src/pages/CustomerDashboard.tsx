import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/lib/toast';
import { format } from 'date-fns';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { publicIdOf } from '@/lib/public-ids';
import { formatAmount } from '@/lib/format';
import { StatusBadge } from '@/components/shared/StatusBadge';
import {
  CheckCircle2,
  Eye,
  Filter,
  Hourglass,
  Info,
  Plus,
  ReceiptText,
  ShoppingBag,
  Store,
  Wallet,
} from 'lucide-react';

interface Order {
  id: string;
  public_order_id: string;
  order_number: string;
  merchant_name: string;
  merchant_avatar: string | null;
  product_name: string;
  product_description: string | null;
  amount: number;
  currency: string;
  status: string;
  escrow_status: string;
  created_at: string;
  expected_delivery: string | null;
  notes: string | null;
}

interface OrderMetrics {
  total: number;
  pending: number;
  completed: number;
  refunded: number;
  totalBalance: number;
}

const statusConfig: Record<string, { color: string; label: string; icon?: string }> = {
  pending: { color: 'warning', label: 'Pending', icon: 'hourglass_top' },
  awaiting_shipment: { color: 'warning', label: 'Awaiting Seller Shipment' },
  shipped: { color: 'primary', label: 'Shipped', icon: 'local_shipping' },
  delivered: { color: 'warning', label: 'Awaiting Delivery' },
  completed: { color: 'success', label: 'Released', icon: 'check_circle' },
  disputed: { color: 'destructive', label: 'Disputed', icon: 'error' },
  refunded: { color: 'destructive', label: 'Refunded', icon: 'replay' },
  cancelled: { color: 'muted', label: 'Cancelled' },
};

export default function CustomerDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [metrics, setMetrics] = useState<OrderMetrics>({
    total: 0,
    pending: 0,
    completed: 0,
    refunded: 0,
    totalBalance: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setOrders(data || []);

      // Calculate metrics
      const total = data?.length || 0;
      const pending = data?.filter(o => ['pending', 'awaiting_shipment', 'shipped', 'delivered'].includes(o.status)).length || 0;
      const completed = data?.filter(o => o.status === 'completed').length || 0;
      const refunded = data?.filter(o => o.status === 'refunded').length || 0;
      const totalBalance = data?.reduce((sum, o) => {
        if (o.escrow_status === 'held') return sum + Number(o.amount);
        return sum;
      }, 0) || 0;

      setMetrics({ total, pending, completed, refunded, totalBalance });
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const handleRefresh = async () => {
    await fetchOrders();
  };

  useEffect(() => {
    fetchOrders();

    // Subscribe to realtime updates
    if (user?.id) {
      const channel = supabase
        .channel('orders-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `customer_id=eq.${user.id}`,
          },
          () => {
            fetchOrders();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user?.id]);

  const handleConfirmDelivery = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'completed', 
          escrow_status: 'released',
          delivered_at: new Date().toISOString() 
        })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: 'Delivery confirmed!',
        description: 'Funds have been released to the merchant.',
      });

      fetchOrders();
    } catch (error) {
      console.error('Error confirming delivery:', error);
      toast({
        title: 'Error',
        description: 'Failed to confirm delivery. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Filter orders by search query
  const filteredOrders = orders.filter(order => 
    (order.public_order_id || order.order_number).toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.merchant_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.product_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get priority actions (pending orders that need action)
  const priorityOrders = orders.filter(o => 
    ['pending', 'awaiting_shipment', 'shipped', 'delivered'].includes(o.status)
  ).slice(0, 2);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 24 * 60 * 60 * 1000) {
      return `Today, ${format(date, 'h:mm a')}`;
    } else if (diff < 48 * 60 * 60 * 1000) {
      return 'Yesterday';
    } else {
      return format(date, 'MMM d');
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <DashboardSkeleton />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="pb-32 sm:pb-28">
          {/* Priority Action Inbox */}
          <div className="mobile-section">
            <div className="mobile-section-header">
              <div className="min-w-0 flex-1">
                <h2 className="text-responsive-xl font-bold text-foreground mb-0.5">
                  Priority Actions
                </h2>
                <p className="text-muted-foreground text-responsive-xs">
                  Tasks requiring your attention
                </p>
              </div>
              <Link to="/payment/new" className="shrink-0">
                <Button size="sm" className="h-9 sm:h-10 rounded-xl text-xs sm:text-sm font-medium px-3 sm:px-4">
                  <Plus className="h-4 w-4 sm:h-[18px] sm:w-[18px] mr-1" />
                  <span className="hidden sm:inline">New </span>Payment
                </Button>
              </Link>
            </div>

            {priorityOrders.length > 0 ? (
              <div className="flex flex-col gap-3">
                {priorityOrders.map((order) => (
                  <div 
                    key={order.id}
                    className="bg-card border-2 border-primary/30 rounded-2xl p-4 shadow-sm"
                  >
                    {/* Merchant & Amount Row */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center border border-border shrink-0 overflow-hidden">
                          {order.merchant_avatar ? (
                            <img 
                              src={order.merchant_avatar} 
                              alt={order.merchant_name}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            <Store className="text-muted-foreground h-[20px] w-[20px]" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-foreground font-semibold text-sm truncate">{order.merchant_name}</p>
                          <p className="text-muted-foreground text-xs">{formatDate(order.created_at)}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-lg text-foreground">
                          {formatAmount(order.amount, order.currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <StatusBadge dot tone="warning" label={statusConfig[order.status]?.label || order.status} />
                      </div>
                    </div>

                    {/* Product Info */}
                    <div className="border-t border-border pt-3">
                      <p className="text-sm font-medium text-foreground mb-1">{order.product_name}</p>
                      <p className="text-xs text-muted-foreground mb-2">Order {publicIdOf(order, 'public_order_id', 'ORD', 'order_number')}</p>
                      <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <Info className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>
                          {order.status === 'delivered' && 'Confirm receipt to release funds'}
                          {order.status === 'awaiting_shipment' && 'Waiting for seller to ship'}
                          {order.status === 'shipped' && 'Order is on the way'}
                          {order.status === 'pending' && 'Payment processing'}
                        </span>
                      </p>

                      {order.status === 'delivered' ? (
                        <Button
                          onClick={() => handleConfirmDelivery(order.id)}
                          className="w-full mt-3 h-11 rounded-xl font-semibold text-sm"
                        >
                          <CheckCircle2 className="h-[18px] w-[18px] mr-1.5" />
                          Confirm Delivery
                        </Button>
                      ) : (
                        <Link to={`/orders/${order.id}`} className="block mt-3">
                          <Button variant="outline" className="w-full h-11 rounded-xl font-semibold text-sm">
                            <Eye className="h-[18px] w-[18px] mr-1.5" />
                            View Details
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
                
                <Link 
                  to="/orders?status=pending"
                  className="text-primary text-xs font-medium text-center py-2"
                >
                  View All Pending →
                </Link>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl p-6 text-center">
                <CheckCircle2 className="h-[40px] w-[40px] text-success mb-2" />
                <p className="text-foreground font-medium text-sm">All caught up!</p>
                <p className="text-muted-foreground text-xs">No pending actions</p>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="mobile-section border-t border-border mt-2">
            <div className="quick-actions mb-4">
              <Link to="/transactions" className="contents">
                <div className="bg-card border border-border rounded-xl p-3 hover:bg-muted/50 active:bg-muted transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <ReceiptText className="text-primary h-[18px] w-[18px] sm:h-[20px] sm:w-[20px]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-foreground text-sm sm:text-base font-medium truncate">Transactions</p>
                      <p className="text-muted-foreground text-[10px] sm:text-xs truncate">Payment history</p>
                    </div>
                  </div>
                </div>
              </Link>
              <Link to="/wallet" className="contents">
                <div className="bg-card border border-border rounded-xl p-3 hover:bg-muted/50 active:bg-muted transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                      <Wallet className="text-success h-[18px] w-[18px] sm:h-[20px] sm:w-[20px]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-foreground text-sm sm:text-base font-medium truncate">Wallet</p>
                      <p className="text-muted-foreground text-[10px] sm:text-xs truncate">Balance & more</p>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
            
            <div className="mobile-section-header">
              <h3 className="mobile-section-title">Recent Orders</h3>
              <Link to="/orders" className="text-primary text-xs sm:text-sm font-medium">
                View All
              </Link>
            </div>

            {/* Search */}
            <div className="mb-3 flex gap-2">
              <Input
                type="text"
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 h-10 sm:h-11 rounded-xl bg-muted/50 border-0 text-sm"
              />
              <button className="w-10 h-10 sm:w-11 sm:h-11 bg-muted/50 rounded-xl flex items-center justify-center text-muted-foreground active:bg-muted shrink-0">
                <Filter className="h-[20px] w-[20px]" />
              </button>
            </div>

            {/* Transactions List */}
            <div className="flex flex-col gap-2 pb-4">
              {filteredOrders.length > 0 ? (
                filteredOrders.slice(0, 10).map((order) => (
                  <Link
                    key={order.id}
                    to={`/orders/${order.id}`}
                    className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl active:bg-muted/50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                      {order.merchant_avatar ? (
                        <img 
                          src={order.merchant_avatar} 
                          alt={order.merchant_name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <Store className="text-muted-foreground h-[18px] w-[18px]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground font-medium text-sm truncate">{order.product_name}</p>
                      <p className="text-muted-foreground text-xs">{formatDate(order.created_at)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-sm text-foreground">
                        {formatAmount(order.amount, order.currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <span className={`text-xs font-medium ${
                        statusConfig[order.status]?.color === 'success' ? 'text-success' :
                        statusConfig[order.status]?.color === 'warning' ? 'text-warning' :
                        statusConfig[order.status]?.color === 'destructive' ? 'text-destructive' :
                        statusConfig[order.status]?.color === 'primary' ? 'text-primary' :
                        'text-muted-foreground'
                      }`}>
                        {statusConfig[order.status]?.label || order.status}
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-center py-10">
                  <ReceiptText className="h-[40px] w-[40px] text-muted-foreground mb-2" />
                  <p className="text-muted-foreground text-sm">
                    {searchQuery ? 'No results found' : 'No transactions yet'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </PullToRefresh>

      {/* Footer Stats - Mobile Optimized */}
      <footer className="fixed bottom-0 left-0 right-0 lg:left-[280px] bg-card border-t border-border px-4 py-3 z-20 shadow-[0_-4px_20px_-2px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between gap-2">
          {/* SafePay Balance */}
          <div className="flex-1">
            <p className="text-muted-foreground text-[10px] uppercase tracking-wide">In SafePay</p>
            <p className="text-lg font-bold text-foreground">₹{metrics.totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          
          {/* Stats Grid */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted/50 rounded-lg">
              <ShoppingBag className="text-primary h-4 w-4" />
              <span className="text-xs font-semibold text-foreground">{metrics.total}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted/50 rounded-lg">
              <Hourglass className="text-warning h-4 w-4" />
              <span className="text-xs font-semibold text-foreground">{metrics.pending}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted/50 rounded-lg">
              <CheckCircle2 className="text-success h-4 w-4" />
              <span className="text-xs font-semibold text-foreground">{metrics.completed}</span>
            </div>
          </div>
        </div>
        
        <Link to="/orders" className="block mt-2">
          <Button variant="outline" size="sm" className="w-full h-9 rounded-lg text-xs font-medium">
            View Full Summary
          </Button>
        </Link>
      </footer>
    </DashboardLayout>
  );
}
