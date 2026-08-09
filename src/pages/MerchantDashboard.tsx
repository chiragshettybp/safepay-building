import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Bell, CheckCircle2, Gavel, Inbox, Landmark, LogOut, ReceiptText, Search, Store, Truck } from 'lucide-react';
import { MerchantBottomNav } from '@/components/shared/MerchantBottomNav';
import { StatusBadge, type StatusTone } from '@/components/shared/StatusBadge';
import { FullPageLoading } from '@/components/shared/LoadingSpinner';

interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  shippedOrders: number;
  completedOrders: number;
  disputedOrders: number;
  totalRevenue: number;
  pendingBalance: number;
  availableBalance: number;
}

interface Order {
  id: string;
  public_order_id: string;
  order_number: string;
  product_name: string;
  amount: number;
  status: string;
  escrow_status: string;
  created_at: string;
  expected_delivery: string | null;
  customer_id: string;
}

interface Activity {
  id: string;
  activity_type: string;
  title: string;
  description: string | null;
  created_at: string;
}

type FilterType = 'all' | 'pending' | 'shipped' | 'delivered' | 'completed' | 'disputed' | 'refunded';

export default function MerchantDashboard() {
  const navigate = useNavigate();
  const { user, merchant, logout, isAuthenticated, isLoading: authLoading } = useMerchantAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    pendingOrders: 0,
    shippedOrders: 0,
    completedOrders: 0,
    disputedOrders: 0,
    totalRevenue: 0,
    pendingBalance: 0,
    availableBalance: 0,
  });
  const [orders, setOrders] = useState<Order[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [alerts, setAlerts] = useState<{ type: string; message: string; count: number }[]>([]);

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

  const fetchDashboardData = useCallback(async () => {
    if (!merchant?.id) return;

    try {
      const { data: wallet } = await supabase
        .from('merchant_wallets')
        .select('balance, pending_balance, total_earned')
        .eq('merchant_id', merchant.id)
        .single();

      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, public_order_id, order_number, product_name, amount, status, escrow_status, created_at, expected_delivery, customer_id, merchant_id')
        .eq('merchant_id', merchant.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (ordersError) {
        console.error('Orders fetch error:', ordersError);
      }

      const merchantOrders: Order[] = (ordersData || []).map((o: any) => ({
        id: o.id,
        public_order_id: o.public_order_id,
        order_number: o.order_number,
        product_name: o.product_name,
        amount: o.amount,
        status: o.status,
        escrow_status: o.escrow_status,
        created_at: o.created_at,
        expected_delivery: o.expected_delivery,
        customer_id: o.customer_id,
      }));

      const pendingOrders = merchantOrders.filter(o => o.status === 'pending' || o.status === 'awaiting_shipment').length;
      const shippedOrders = merchantOrders.filter(o => o.status === 'shipped').length;
      const completedOrders = merchantOrders.filter(o => o.status === 'completed' || o.status === 'delivered').length;
      const disputedOrders = merchantOrders.filter(o => o.status === 'disputed').length;

      setStats({
        totalOrders: merchantOrders.length,
        pendingOrders,
        shippedOrders,
        completedOrders,
        disputedOrders,
        totalRevenue: Number(wallet?.total_earned) || 0,
        pendingBalance: Number(wallet?.pending_balance) || 0,
        availableBalance: Number(wallet?.balance) || 0,
      });

      setOrders(merchantOrders);

      const newAlerts: { type: string; message: string; count: number }[] = [];
      
      if (pendingOrders > 0) {
        newAlerts.push({
          type: 'shipment',
          message: `${pendingOrders} order${pendingOrders > 1 ? 's' : ''} need${pendingOrders === 1 ? 's' : ''} shipment`,
          count: pendingOrders,
        });
      }
      
      if (disputedOrders > 0) {
        newAlerts.push({
          type: 'dispute',
          message: `${disputedOrders} dispute${disputedOrders > 1 ? 's' : ''} need${disputedOrders === 1 ? 's' : ''} response`,
          count: disputedOrders,
        });
      }

      setAlerts(newAlerts);

      const { data: activityData } = await supabase
        .from('merchant_activity')
        .select('*')
        .eq('merchant_id', merchant.id)
        .order('created_at', { ascending: false })
        .limit(10);

      setActivities(activityData || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, [merchant?.id]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    if (!merchant?.id) return;

    const ordersChannel = supabase
      .channel('merchant-orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `merchant_id=eq.${merchant.id}`,
        },
        (payload) => {
          console.log('Order change:', payload);
          fetchDashboardData();
          if (payload.eventType === 'INSERT') {
            toast.success('New order received!');
          } else if (payload.eventType === 'UPDATE') {
            toast.info('Order status updated');
          }
        }
      )
      .subscribe();

    const activityChannel = supabase
      .channel('merchant-activity-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'merchant_activity',
          filter: `merchant_id=eq.${merchant.id}`,
        },
        (payload) => {
          console.log('Activity change:', payload);
          setActivities(prev => [payload.new as Activity, ...prev.slice(0, 9)]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(activityChannel);
    };
  }, [merchant?.id, fetchDashboardData]);

  const handleLogout = async () => {
    await logout();
    navigate('/merchant-login', { replace: true });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { tone: StatusTone; label: string }> = {
      pending: { tone: 'neutral', label: 'Pending' },
      awaiting_shipment: { tone: 'neutral', label: 'Awaiting Shipment' },
      shipped: { tone: 'info', label: 'Shipped' },
      delivered: { tone: 'info', label: 'Delivered' },
      completed: { tone: 'info', label: 'Completed' },
      disputed: { tone: 'destructive', label: 'Disputed' },
      refunded: { tone: 'neutral', label: 'Refunded' },
      cancelled: { tone: 'neutral', label: 'Cancelled' },
    };
    const config = statusConfig[status] || { tone: 'neutral' as const, label: status };
    return <StatusBadge tone={config.tone} label={config.label} className="text-[10px] px-1.5 py-0.5" />;
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.public_order_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.product_name.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeFilter === 'all') return matchesSearch;
    if (activeFilter === 'pending') return matchesSearch && (order.status === 'pending' || order.status === 'awaiting_shipment');
    return matchesSearch && order.status === activeFilter;
  });

  const handleFilterClick = (filter: FilterType) => {
    setActiveFilter(filter);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (authLoading || !isAuthenticated || !merchant) {
    return <FullPageLoading />;
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border safe-top">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Store className="h-[18px] w-[18px] text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{merchant.businessName}</p>
              <p className="text-[11px] text-muted-foreground">{user?.phone}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Link to="/merchant-notifications" className="p-2.5 hover:bg-muted rounded-full relative touch-target">
              <Bell className="h-5 w-5 text-foreground" />
              {alerts.length > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full"></span>
              )}
            </Link>
            <button onClick={handleLogout} className="p-2.5 hover:bg-muted rounded-full touch-target">
              <LogOut className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        <div className="px-4 py-4 space-y-4">
          {/* Welcome */}
          <div>
            <h1 className="text-xl font-bold text-foreground">
              Welcome, {user?.fullName?.split(' ')[0] || 'Merchant'}!
            </h1>
            <p className="text-sm text-muted-foreground">Here's your business overview</p>
          </div>

          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="space-y-2">
              {alerts.map((alert, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-2.5 p-3 rounded-xl ${
                    alert.type === 'dispute' ? 'bg-destructive/10' : 'bg-amber-500/10'
                  }`}
                >
                  {alert.type === 'dispute' ? (
                    <Gavel className="h-[18px] w-[18px] text-destructive" />
                  ) : (
                    <Truck className="h-[18px] w-[18px] text-amber-600" />
                  )}
                  <p className="text-xs text-foreground flex-1">{alert.message}</p>
                  <Link to={alert.type === 'dispute' ? '/merchant-disputes' : '/merchant-orders'}>
                    <Button size="sm" variant="ghost" className="h-7 text-xs px-2">
                      View
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}

          {/* KPI Cards - 2x2 Grid */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleFilterClick('all')}
              className={`bg-muted/50 rounded-xl p-3 text-left transition-all active:scale-[0.98] ${
                activeFilter === 'all' ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''
              }`}
            >
              {isLoading ? (
                <Skeleton className="h-7 w-12 mb-0.5" />
              ) : (
                <p className="text-2xl font-bold text-foreground">{stats.totalOrders}</p>
              )}
              <p className="text-[11px] text-muted-foreground">Total Orders</p>
            </button>
            <button
              onClick={() => handleFilterClick('pending')}
              className={`bg-amber-500/10 rounded-xl p-3 text-left transition-all active:scale-[0.98] ${
                activeFilter === 'pending' ? 'ring-2 ring-amber-500 ring-offset-1 ring-offset-background' : ''
              }`}
            >
              {isLoading ? (
                <Skeleton className="h-7 w-12 mb-0.5" />
              ) : (
                <p className="text-2xl font-bold text-amber-600">{stats.pendingOrders}</p>
              )}
              <p className="text-[11px] text-muted-foreground">Pending</p>
            </button>
            <button
              onClick={() => handleFilterClick('shipped')}
              className={`bg-primary/10 rounded-xl p-3 text-left transition-all active:scale-[0.98] ${
                activeFilter === 'shipped' ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''
              }`}
            >
              {isLoading ? (
                <Skeleton className="h-7 w-12 mb-0.5" />
              ) : (
                <p className="text-2xl font-bold text-primary">{stats.shippedOrders}</p>
              )}
              <p className="text-[11px] text-muted-foreground">In Transit</p>
            </button>
            <button
              onClick={() => handleFilterClick('disputed')}
              className={`bg-destructive/10 rounded-xl p-3 text-left transition-all active:scale-[0.98] ${
                activeFilter === 'disputed' ? 'ring-2 ring-destructive ring-offset-1 ring-offset-background' : ''
              }`}
            >
              {isLoading ? (
                <Skeleton className="h-7 w-12 mb-0.5" />
              ) : (
                <p className="text-2xl font-bold text-destructive">{stats.disputedOrders}</p>
              )}
              <p className="text-[11px] text-muted-foreground">Disputes</p>
            </button>
          </div>

          {/* Balance Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-primary rounded-xl p-3.5 text-primary-foreground">
              <p className="text-[11px] opacity-80 mb-0.5">Available</p>
              {isLoading ? (
                <Skeleton className="h-7 w-20 bg-primary-foreground/20" />
              ) : (
                <p className="text-xl font-bold">{formatAmount(stats.availableBalance)}</p>
              )}
              <Link to="/merchant-payouts">
                <Button size="sm" variant="secondary" className="mt-2.5 h-7 text-[11px] px-2.5">
                  <Landmark className="h-3.5 w-3.5 mr-1" />
                  Withdraw
                </Button>
              </Link>
            </div>
            <div className="bg-muted/50 rounded-xl p-3.5">
              <p className="text-[11px] text-muted-foreground mb-0.5">In SafePay</p>
              {isLoading ? (
                <Skeleton className="h-7 w-20" />
              ) : (
                <p className="text-xl font-bold text-foreground">{formatAmount(stats.pendingBalance)}</p>
              )}
              <p className="text-[10px] text-muted-foreground mt-2.5">Released after delivery</p>
            </div>
          </div>

          {/* Orders Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-foreground">Orders</h2>
              <Link to="/merchant-orders" className="text-xs text-primary font-medium">
                View All
              </Link>
            </div>
            
            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-[18px] w-[18px]" />
              <Input
                type="text"
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 text-sm"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-4 px-4 scrollbar-hide">
              {(['all', 'pending', 'shipped', 'completed', 'disputed'] as FilterType[]).map((filter) => (
                <button
                  key={filter}
                  onClick={() => handleFilterClick(filter)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all active:scale-95 ${
                    activeFilter === filter
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>

            {/* Orders List */}
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-muted/30 rounded-xl p-3">
                    <Skeleton className="h-4 w-24 mb-1.5" />
                    <Skeleton className="h-3 w-36 mb-1.5" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))}
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="bg-muted/30 rounded-xl p-6 text-center">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
                  <Inbox className="h-[18px] w-[18px] text-muted-foreground" />
                </div>
                <h3 className="text-sm font-medium text-foreground mb-0.5">No orders found</h3>
                <p className="text-xs text-muted-foreground">
                  {searchQuery || activeFilter !== 'all' ? 'Try different filters' : 'Orders will appear here'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredOrders.slice(0, 5).map((order) => (
                  <Link
                    key={order.id}
                    to={`/merchant-order/${order.id}`}
                    className="block bg-muted/30 rounded-xl p-3 active:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground font-mono">{order.public_order_id || `#${order.order_number}`}</p>
                        <p className="text-xs text-muted-foreground truncate">{order.product_name}</p>
                      </div>
                      {getStatusBadge(order.status)}
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{formatDate(order.created_at)}</span>
                      <span className="font-semibold text-foreground">{formatAmount(order.amount)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Activity Section */}
          {activities.length > 0 && (
            <div>
              <h2 className="text-base font-semibold text-foreground mb-3">Recent Activity</h2>
              <div className="space-y-2">
                {activities.slice(0, 5).map((activity) => (
                  <div key={activity.id} className="flex items-start gap-2.5 p-3 bg-muted/30 rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      {activity.activity_type === 'tracking' ? (
                        <Truck className="h-3.5 w-3.5 text-primary" />
                      ) : activity.activity_type === 'delivery' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <ReceiptText className="h-3.5 w-3.5 text-primary" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground">{activity.title}</p>
                      {activity.description && (
                        <p className="text-[11px] text-muted-foreground truncate">{activity.description}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatDate(activity.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <MerchantBottomNav />
    </div>
  );
}
