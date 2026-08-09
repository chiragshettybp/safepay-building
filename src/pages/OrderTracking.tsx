import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays } from 'date-fns';
import { ArrowLeft, Package, Check, Truck, FileText, Lock, Clock, AlertCircle, MapPin, CheckCircle, AlertTriangle, Copy } from 'lucide-react';
import { toast } from '@/lib/toast';
import { publicIdOf } from '@/lib/public-ids';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { FullPageLoading } from '@/components/shared/LoadingSpinner';

interface Order {
  id: string;
  public_order_id: string;
  order_number: string;
  merchant_name: string;
  product_name: string;
  status: string;
  escrow_status: string;
  created_at: string;
  expected_delivery: string | null;
  delivered_at: string | null;
}

interface TrackingInfo {
  tracking_number: string;
  courier_partner: string;
  status: string;
  shipment_date: string | null;
  estimated_delivery: string | null;
}

interface OrderEvent {
  id: string;
  event_type: string;
  title: string;
  description: string | null;
  created_at: string;
  new_status: string | null;
}

const eventIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  created: FileText,
  escrow_change: Lock,
  status_change: Package,
};

export default function OrderTracking() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [tracking, setTracking] = useState<TrackingInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOrderAndEvents = async () => {
      if (!id || !user?.id) return;
      try {
        const [orderResult, eventsResult, trackingResult] = await Promise.all([
          supabase.from('orders').select('*').eq('id', id).eq('customer_id', user.id).maybeSingle(),
          supabase.from('order_events').select('*').eq('order_id', id).order('created_at', { ascending: false }),
          supabase.from('order_tracking').select('tracking_number, courier_partner, status, shipment_date, estimated_delivery').eq('order_id', id).maybeSingle()
        ]);

        if (orderResult.error) throw orderResult.error;
        if (!orderResult.data) { navigate('/orders'); return; }
        
        setOrder(orderResult.data);
        setEvents(eventsResult.data || []);
        if (trackingResult.data) setTracking(trackingResult.data);
      } catch (error) {
        console.error('Error fetching order:', error);
        navigate('/orders');
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrderAndEvents();

    // Subscribe to real-time updates for events, orders, and tracking
    const channel = supabase
      .channel(`order-tracking-all-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_events', filter: `order_id=eq.${id}` }, (payload) => {
        setEvents(prev => [payload.new as OrderEvent, ...prev]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, (payload) => {
        if (payload.new) setOrder(payload.new as Order);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_tracking', filter: `order_id=eq.${id}` }, (payload) => {
        if (payload.new) setTracking(payload.new as TrackingInfo);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, user?.id, navigate]);

  const getEventIcon = (event: OrderEvent) => {
    if (event.new_status === 'shipped') return Truck;
    if (event.new_status === 'delivered') return MapPin;
    if (event.new_status === 'completed') return CheckCircle;
    if (event.new_status === 'disputed') return AlertTriangle;
    if (event.event_type === 'escrow_change') return Lock;
    if (event.event_type === 'created') return FileText;
    return Package;
  };

  if (isLoading) {
    return (
      <FullPageLoading />
    );
  }

  if (!order) return null;

  const copyOrderNumber = () => {
    navigator.clipboard.writeText(publicIdOf(order, 'public_order_id', 'ORD', 'order_number'));
    toast({ title: 'Copied!', description: 'Order number copied' });
  };

  // Check if order has shipping info — also consider tracking existence
  const isShipped = ['shipped', 'delivered', 'completed'].includes(order.status) || !!tracking;
  const isDelivered = ['delivered', 'completed'].includes(order.status);
  const isPending = ['pending', 'awaiting_shipment'].includes(order.status) && !tracking;

  const expectedDelivery = order.expected_delivery 
    ? format(new Date(order.expected_delivery), 'd MMM yyyy')
    : isShipped 
      ? format(addDays(new Date(order.created_at), 5), 'd MMM yyyy')
      : null;

  // Calculate progress
  const getProgress = () => {
    if (order.status === 'completed') return 100;
    if (order.status === 'delivered') return 90;
    if (order.status === 'shipped') return 60;
    if (order.status === 'awaiting_shipment') return 30;
    return 15;
  };

  const getStatusLabel = () => {
    if (order.status === 'completed') return 'Completed';
    if (order.status === 'delivered') return 'Delivered';
    if (order.status === 'shipped') return 'In Transit';
    if (order.status === 'awaiting_shipment') return 'Processing';
    return 'Pending';
  };

  const getStatusTone = (): 'success' | 'warning' | 'neutral' => {
    if (order.status === 'completed' || order.status === 'delivered') return 'success';
    if (order.status === 'shipped') return 'warning';
    return 'neutral';
  };

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(`/orders/${order.id}`)} className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <h1 className="font-bold text-foreground">Tracking</h1>
          <Link to={`/orders/${order.id}/report`} className="px-3 py-1.5 rounded-full border border-destructive text-destructive text-xs font-semibold hover:bg-destructive/5">
            Support
          </Link>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-4">
        {/* Not Yet Shipped State */}
        {isPending && (
          <div className="bg-background rounded-2xl border border-border p-6 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
              <Clock className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Not Yet Shipped</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Your order is being prepared by the merchant. Tracking information will be available once the package is shipped.
              </p>
            </div>
            <button onClick={copyOrderNumber} className="inline-flex items-center gap-2 bg-muted px-4 py-2 rounded-lg text-sm font-mono font-medium text-primary hover:bg-muted/80">
              {publicIdOf(order, 'public_order_id', 'ORD', 'order_number')}
            </button>
          </div>
        )}

        {/* Status Card - Only show if shipped */}
        {isShipped && (
          <div className="bg-background rounded-2xl border border-border p-5 space-y-4">
            <div className="flex items-center justify-between">
              <StatusBadge tone={getStatusTone()} label={getStatusLabel()} />
              <button onClick={copyOrderNumber} className="flex items-center gap-1.5 bg-muted px-3 py-1.5 rounded-lg text-sm font-mono font-medium text-primary hover:bg-muted/80">
                {publicIdOf(order, 'public_order_id', 'ORD', 'order_number')}
              </button>
            </div>
            
            {expectedDelivery && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  {isDelivered ? 'Delivered On' : 'Expected Delivery'}
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {order.delivered_at ? format(new Date(order.delivered_at), 'd MMM yyyy') : expectedDelivery}
                </p>
              </div>
            )}

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-medium text-muted-foreground">
                <span>Order Placed</span>
                <span>Delivered</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ${
                    isDelivered ? 'bg-success' : 'bg-primary'
                  }`} 
                  style={{ width: `${getProgress()}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Info Card for pending orders */}
        {isPending && (
          <div className="bg-primary/5 rounded-xl border border-primary/20 p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm text-foreground">Waiting for Merchant</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                The merchant will ship your order soon. You'll receive tracking updates once the package is dispatched.
              </p>
            </div>
          </div>
        )}

        {/* Tracking Details Card */}
        {tracking && (
          <div className="bg-background rounded-2xl border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-primary" />
              <h3 className="font-bold text-sm text-foreground">Shipment Details</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tracking #</span>
                <button onClick={() => { navigator.clipboard.writeText(tracking.tracking_number); toast({ title: 'Copied!', description: 'Tracking number copied' }); }} className="font-mono text-xs text-primary flex items-center gap-1">
                  {tracking.tracking_number}
                  <Copy className="w-3 h-3" />
                </button>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Courier</span>
                <span className="font-medium text-foreground">{tracking.courier_partner}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium text-foreground capitalize">{tracking.status.replace('_', ' ')}</span>
              </div>
              {tracking.estimated_delivery && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Est. Delivery</span>
                  <span className="font-medium text-foreground">{format(new Date(tracking.estimated_delivery), 'd MMM yyyy')}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Timeline from real events */}
        <div className="bg-background rounded-2xl border border-border">
          <h3 className="font-bold text-foreground px-4 pt-4 pb-2">Order Timeline</h3>
          {events.length > 0 ? (
            <div className="space-y-0">
              {events.map((event, i) => {
                const IconComponent = getEventIcon(event);
                return (
                  <div 
                    key={event.id} 
                    className="flex gap-3 px-4 py-3 relative"
                  >
                    {i < events.length - 1 && (
                      <div className="absolute left-[30px] top-12 bottom-0 w-0.5 bg-success/30" />
                    )}
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 bg-success/10 text-success">
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm text-foreground">{event.title}</p>
                          <p className="text-xs text-muted-foreground">{event.description}</p>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {format(new Date(event.created_at), 'MMM d, h:mm a')}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No timeline events yet
            </div>
          )}
        </div>

        {/* Order Info */}
        <div className="bg-background rounded-xl border border-border p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Merchant</span>
            <span className="text-sm font-medium text-foreground">{order.merchant_name}</span>
          </div>
          <div className="h-px bg-border" />
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Product</span>
            <span className="text-sm font-medium text-foreground">{order.product_name}</span>
          </div>
          <div className="h-px bg-border" />
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Status</span>
            <span className={`text-sm font-medium capitalize ${
              isDelivered ? 'text-success' : 
              isShipped ? 'text-warning' : 'text-muted-foreground'
            }`}>{order.status.replace('_', ' ')}</span>
          </div>
        </div>
      </main>
    </div>
  );
}
