import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ArrowLeft, HelpCircle, Lock, CheckCircle, Truck, Package, AlertTriangle, MapPin, FileText, Clock } from 'lucide-react';
import { toast } from '@/lib/toast';
import { publicIdOf } from '@/lib/public-ids';
import { formatAmount } from '@/lib/format';

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
  delivered_at: string | null;
}

interface OrderEvent {
  id: string;
  event_type: string;
  title: string;
  description: string | null;
  created_at: string;
  new_status: string | null;
}

interface OrderItem {
  id: string;
  item_name: string;
  variant_label: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
  image_url: string | null;
}

const statusLabels: Record<string, string> = {
  pending: 'PENDING',
  awaiting_shipment: 'AWAITING SHIPMENT',
  shipped: 'IN TRANSIT',
  delivered: 'DELIVERED',
  completed: 'COMPLETED',
  disputed: 'DISPUTED',
  refunded: 'REFUNDED',
  cancelled: 'CANCELLED',
};

const eventIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  created: FileText,
  escrow_change: Lock,
  status_change: Package,
  shipped: Truck,
  delivered: MapPin,
  completed: CheckCircle,
  disputed: AlertTriangle,
};

export default function OrderDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOrderAndEvents = async () => {
      if (!id || !user?.id) return;
      try {
        // Fetch order and events in parallel
        const [orderResult, eventsResult, itemsResult] = await Promise.all([
          supabase.from('orders').select('*').eq('id', id).eq('customer_id', user.id).maybeSingle(),
          supabase.from('order_events').select('*').eq('order_id', id).order('created_at', { ascending: false }),
          supabase.from('order_items').select('*').eq('order_id', id).order('created_at', { ascending: true })
        ]);

        if (orderResult.error) throw orderResult.error;
        if (!orderResult.data) { navigate('/orders'); return; }
        
        setOrder(orderResult.data);
        setEvents(eventsResult.data || []);
        setItems(itemsResult.data || []);
      } catch (error) {
        console.error('Error fetching order:', error);
        navigate('/orders');
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrderAndEvents();

    // Subscribe to real-time event updates
    const channel = supabase
      .channel(`order-events-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_events', filter: `order_id=eq.${id}` }, (payload) => {
        setEvents(prev => [payload.new as OrderEvent, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, user?.id, navigate]);

  const copyOrderId = () => {
    if (order) {
      navigator.clipboard.writeText(publicIdOf(order, 'public_order_id', 'ORD', 'order_number'));
      toast({ title: 'Copied!', description: 'Order ID copied to clipboard' });
    }
  };

  const getEventIcon = (event: OrderEvent) => {
    if (event.new_status === 'shipped') return Truck;
    if (event.new_status === 'delivered') return MapPin;
    if (event.new_status === 'completed') return CheckCircle;
    if (event.new_status === 'disputed') return AlertTriangle;
    return eventIcons[event.event_type] || Clock;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Order not found</p>
      </div>
    );
  }

  return (
    <div className="mobile-page flex flex-col pb-28 sm:pb-32">
      {/* Header */}
      <header className="sticky-header bg-background">
        <div className="sticky-header-content">
          <button onClick={() => navigate('/orders')} className="back-btn">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-sm sm:text-base text-foreground">Order Details</h1>
          <button className="p-2 rounded-full hover:bg-muted shrink-0">
            <HelpCircle className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
      </header>

      <main className="flex-1 mobile-section space-y-3 sm:space-y-4">
        {/* Order Summary Card */}
        <div className="info-card p-4 sm:p-5 space-y-3 sm:space-y-4">
          {/* Order ID */}
          <button onClick={copyOrderId} className="inline-flex items-center gap-1.5 sm:gap-2 bg-primary/10 text-primary text-xs sm:text-sm font-semibold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full hover:bg-primary/20 transition-colors">
            {publicIdOf(order, 'public_order_id', 'ORD', 'order_number')}
          </button>

          {/* Merchant */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-background shadow-sm shrink-0">
              {order.merchant_avatar ? (
                <img src={order.merchant_avatar} alt={order.merchant_name} className="w-full h-full object-cover" />
              ) : (
                <Package className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm sm:text-base text-foreground truncate">{order.merchant_name}</p>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">{order.product_name}</p>
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Amount */}
          <div className="text-center py-1 sm:py-2">
            <div className="flex items-center justify-center gap-1.5 sm:gap-2">
              <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <span className="text-2xl sm:text-3xl font-bold text-primary">
                {formatAmount(order.amount, order.currency)}
              </span>
            </div>
            <div className={`inline-flex items-center gap-1 sm:gap-1.5 mt-2 sm:mt-3 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wide ${
              order.status === 'completed' ? 'bg-success text-success-foreground' :
              order.status === 'disputed' ? 'bg-destructive text-destructive-foreground' :
              'bg-primary text-primary-foreground'
            }`}>
              {order.escrow_status === 'held' && <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-current animate-pulse" />}
              {statusLabels[order.status] || order.status}
            </div>
          </div>
        </div>

        {/* Items snapshot (hosted checkout orders) */}
        {items.length > 0 && (
          <div className="info-card">
            <h3 className="font-bold text-sm sm:text-base text-foreground px-3.5 sm:px-4 pt-3.5 sm:pt-4 pb-2">Items</h3>
            <div className="info-card-content">
              {items.map((item) => (
                <div key={item.id} className="info-card-row">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.item_name} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs sm:text-sm text-foreground truncate">{item.item_name}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">
                      {item.variant_label && `${item.variant_label} · `}
                      {formatAmount(item.unit_price, order.currency)} × {item.quantity}
                    </p>
                  </div>
                  <span className="font-semibold text-xs sm:text-sm text-foreground shrink-0">
                    {formatAmount(item.line_total, order.currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timeline from real events */}
        <div className="info-card">
          <h3 className="font-bold text-sm sm:text-base text-foreground px-3.5 sm:px-4 pt-3.5 sm:pt-4 pb-2">Order Activity</h3>
          {events.length > 0 ? (
            <div className="info-card-content">
              {events.slice(0, 5).map((event) => {
                const IconComponent = getEventIcon(event);
                return (
                  <div key={event.id} className="info-card-row">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 bg-success/10 text-success">
                      <IconComponent className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs sm:text-sm text-foreground">{event.title}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{event.description}</p>
                    </div>
                    <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">
                      {format(new Date(event.created_at), 'MMM d')}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-3.5 sm:px-4 py-5 sm:py-6 text-center text-xs sm:text-sm text-muted-foreground">
              No activity yet
            </div>
          )}
        </div>

        {/* Quick Actions - Always visible */}
        <div className="space-y-2 sm:space-y-3">
          <Link
            to={`/orders/${order.id}/tracking`}
            className="list-item"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Truck className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-xs sm:text-sm text-foreground">Track Shipment</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">View live tracking info</p>
            </div>
            <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180 shrink-0" />
          </Link>
        </div>
      </main>

      {/* Bottom Actions - Only show for active orders */}
      {!['completed', 'disputed', 'refunded', 'cancelled'].includes(order.status) && (
        <div className="bottom-action">
          <div className="quick-actions max-w-lg mx-auto">
            <Link
              to={`/orders/${order.id}/confirm`}
              className="quick-action-btn bg-success text-success-foreground shadow-sm"
            >
              <CheckCircle className="w-4 h-4" />
              <span className="truncate">Confirm Delivery</span>
            </Link>
            <Link
              to={`/dispute/${order.id}`}
              className="quick-action-btn bg-destructive/10 text-destructive"
            >
              <AlertTriangle className="w-4 h-4" />
              <span className="truncate">Report Issue</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
