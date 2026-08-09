import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
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
import {
  ArrowLeft,
  Eye,
  Filter,
  Inbox,
  Pencil,
  Scale,
  Search,
  Truck,
  UploadCloud,
} from 'lucide-react';
import { MerchantBottomNav } from '@/components/shared/MerchantBottomNav';
import { StatusBadge, type StatusTone } from '@/components/shared/StatusBadge';
import { FullPageLoading } from '@/components/shared/LoadingSpinner';

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
  has_tracking?: boolean;
  has_proof?: boolean;
}

type StatusFilter = 'all' | 'pending' | 'in_transit' | 'delivered' | 'completed' | 'disputed' | 'refunded';

export default function MerchantOrders() {
  const navigate = useNavigate();
  const { merchant, isAuthenticated, isLoading: authLoading } = useMerchantAuth();
  const [orders, setOrders] = useState<Order[]>([]);
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

  const fetchOrders = useCallback(async () => {
    if (!merchant?.id) return;

    try {
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select('id, public_order_id, order_number, product_name, amount, status, escrow_status, created_at, expected_delivery, customer_id, merchant_id')
        .eq('merchant_id', merchant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const { data: trackingData } = await supabase
        .from('order_tracking')
        .select('order_id')
        .eq('merchant_id', merchant.id);

      const trackingOrderIds = new Set((trackingData || []).map((t: any) => t.order_id));

      const { data: proofsData } = await supabase
        .from('delivery_proofs')
        .select('order_id')
        .eq('merchant_id', merchant.id);

      const proofOrderIds = new Set((proofsData || []).map((p: any) => p.order_id));

      const merchantOrders: Order[] = (ordersData || [])
        .map((o: any) => ({
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
          has_tracking: trackingOrderIds.has(o.id),
          has_proof: proofOrderIds.has(o.id),
        }));

      setOrders(merchantOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setIsLoading(false);
    }
  }, [merchant?.id]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (!merchant?.id) return;

    const channel = supabase
      .channel('merchant-orders-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_tracking' }, () => fetchOrders())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [merchant?.id, fetchOrders]);

  const getStatusBadge = (status: string) => {
    const config: Record<string, { tone: StatusTone; label: string }> = {
      pending: { tone: 'neutral', label: 'Pending' },
      awaiting_shipment: { tone: 'neutral', label: 'Awaiting' },
      in_transit: { tone: 'info', label: 'In Transit' },
      shipped: { tone: 'info', label: 'Shipped' },
      delivered: { tone: 'info', label: 'Delivered' },
      completed: { tone: 'info', label: 'Completed' },
      disputed: { tone: 'destructive', label: 'Disputed' },
      refunded: { tone: 'neutral', label: 'Refunded' },
      cancelled: { tone: 'neutral', label: 'Cancelled' },
    };
    const c = config[status] || { tone: 'neutral' as const, label: status };
    return <StatusBadge tone={c.tone} label={c.label} className="text-[10px] px-1.5 py-0.5" />;
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.public_order_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.product_name.toLowerCase().includes(searchQuery.toLowerCase());

    if (statusFilter === 'all') return matchesSearch;
    if (statusFilter === 'pending') {
      return matchesSearch && (order.status === 'pending' || order.status === 'awaiting_shipment');
    }
    return matchesSearch && order.status === statusFilter;
  });

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
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border safe-top">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/merchant-dashboard')} className="p-2 -ml-2 hover:bg-muted rounded-full touch-target">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-semibold text-foreground">Orders</h1>
          </div>
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger asChild>
              <button className="p-2 hover:bg-muted rounded-full touch-target lg:hidden">
                <Filter className="h-5 w-5" />
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
                      <SelectItem value="all">All Orders</SelectItem>
                      <SelectItem value="pending">Pending Shipment</SelectItem>
                      <SelectItem value="in_transit">In Transit</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="disputed">Disputed</SelectItem>
                      <SelectItem value="refunded">Refunded</SelectItem>
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

          {/* Status Pills */}
          <div className="flex gap-2 overflow-x-auto pb-3 mb-3 -mx-4 px-4 scrollbar-hide">
            {(['all', 'pending', 'in_transit', 'completed', 'disputed'] as StatusFilter[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all active:scale-95 ${
                  statusFilter === filter
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {filter === 'all' ? 'All' : filter === 'in_transit' ? 'In Transit' : filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>

          {/* Orders List */}
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="bg-muted/30 rounded-xl p-3">
                  <Skeleton className="h-4 w-24 mb-1.5" />
                  <Skeleton className="h-3 w-36 mb-1.5" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="bg-muted/30 rounded-xl p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                <Inbox className="text-muted-foreground h-6 w-6" />
              </div>
              <h3 className="text-sm font-medium text-foreground mb-1">No orders found</h3>
              <p className="text-xs text-muted-foreground">
                {searchQuery || statusFilter !== 'all' ? 'Try different filters' : 'Orders will appear here'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-muted/30 rounded-xl p-3 active:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground font-mono">{order.public_order_id || `#${order.order_number}`}</p>
                      <p className="text-xs text-muted-foreground truncate">{order.product_name}</p>
                    </div>
                    {getStatusBadge(order.status)}
                  </div>

                  <div className="flex items-center justify-between text-xs mb-3">
                    <span className="text-muted-foreground">{formatDate(order.created_at)}</span>
                    <span className="font-semibold text-foreground">{formatAmount(order.amount)}</span>
                  </div>

                  {/* Action Buttons - Horizontal scroll on mobile */}
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
                    <Link to={`/merchant-order/${order.id}`}>
                      <Button size="sm" variant="outline" className="h-8 text-xs whitespace-nowrap flex-shrink-0">
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        View
                      </Button>
                    </Link>

                    {!order.has_tracking && (order.status === 'pending' || order.status === 'awaiting_shipment') && (
                      <Link to={`/merchant-add-tracking/${order.id}`}>
                        <Button size="sm" className="h-8 text-xs whitespace-nowrap flex-shrink-0">
                          <Truck className="h-3.5 w-3.5 mr-1" />
                          Add Tracking
                        </Button>
                      </Link>
                    )}

                    {order.has_tracking && order.status !== 'completed' && order.status !== 'refunded' && (
                      <Link to={`/merchant-edit-tracking/${order.id}`}>
                        <Button size="sm" variant="secondary" className="h-8 text-xs whitespace-nowrap flex-shrink-0">
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          Edit
                        </Button>
                      </Link>
                    )}

                    {!order.has_proof && order.status !== 'pending' && order.status !== 'cancelled' && (
                      <Link to={`/merchant-delivery-proof/${order.id}`}>
                        <Button size="sm" variant="secondary" className="h-8 text-xs whitespace-nowrap flex-shrink-0">
                          <UploadCloud className="h-3.5 w-3.5 mr-1" />
                          Proof
                        </Button>
                      </Link>
                    )}

                    {order.status === 'disputed' && (
                      <Link to={`/merchant-dispute/${order.id}`}>
                        <Button size="sm" variant="destructive" className="h-8 text-xs whitespace-nowrap flex-shrink-0">
                          <Scale className="h-3.5 w-3.5 mr-1" />
                          Respond
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <MerchantBottomNav />
    </div>
  );
}
