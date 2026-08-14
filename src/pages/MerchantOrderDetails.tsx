import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, Gavel, Lock, LucideIcon, Pencil, Plane, Plus, Reply, ShoppingCart, Truck, UploadCloud, Wallet } from 'lucide-react';
import { MerchantBottomNav } from '@/components/shared/MerchantBottomNav';
import { StatusBadge, type StatusTone } from '@/components/shared/StatusBadge';
import { FullPageLoading } from '@/components/shared/LoadingSpinner';

interface OrderDetails {
  id: string;
  public_order_id: string;
  order_number: string;
  product_name: string;
  product_description: string | null;
  amount: number;
  status: string;
  escrow_status: string;
  created_at: string;
  expected_delivery: string | null;
  delivered_at: string | null;
  customer_id: string;
  notes: string | null;
}

interface Tracking {
  id: string;
  tracking_number: string;
  courier_partner: string;
  status: string;
  shipment_date: string | null;
  estimated_delivery: string | null;
}

interface DeliveryProof {
  id: string;
  file_urls: string[];
  delivery_notes: string | null;
  delivery_date: string;
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

interface TimelineEvent {
  id: string;
  title: string;
  description: string | null;
  icon: LucideIcon;
  date: string;
  completed: boolean;
}

export default function MerchantOrderDetails() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { merchant, isAuthenticated, isLoading: authLoading } = useMerchantAuth();
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [tracking, setTracking] = useState<Tracking | null>(null);
  const [deliveryProof, setDeliveryProof] = useState<DeliveryProof | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/merchant-login', { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  const fetchOrderDetails = useCallback(async () => {
    if (!orderId || !merchant?.id) return;

    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .eq('merchant_id', merchant.id)
        .single();

      if (orderError) throw orderError;

      setOrder({
        id: orderData.id,
        public_order_id: orderData.public_order_id,
        order_number: orderData.order_number,
        product_name: orderData.product_name,
        product_description: orderData.product_description,
        amount: orderData.amount,
        status: orderData.status,
        escrow_status: orderData.escrow_status,
        created_at: orderData.created_at,
        expected_delivery: orderData.expected_delivery,
        delivered_at: orderData.delivered_at,
        customer_id: orderData.customer_id,
        notes: orderData.notes,
      });

      const { data: trackingData } = await supabase
        .from('order_tracking')
        .select('*')
        .eq('order_id', orderId)
        .single();

      if (trackingData) {
        setTracking({
          id: trackingData.id,
          tracking_number: trackingData.tracking_number,
          courier_partner: trackingData.courier_partner,
          status: trackingData.status,
          shipment_date: trackingData.shipment_date,
          estimated_delivery: trackingData.estimated_delivery,
        });
      }

      const { data: proofData } = await supabase
        .from('delivery_proofs')
        .select('*')
        .eq('order_id', orderId)
        .single();

      if (proofData) {
        setDeliveryProof({
          id: proofData.id,
          file_urls: proofData.file_urls || [],
          delivery_notes: proofData.delivery_notes,
          delivery_date: proofData.delivery_date,
        });
      }

      const { data: itemsData } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });
      setItems(itemsData || []);

      // Build timeline
      const events: TimelineEvent[] = [
        {
          id: '1',
          title: 'Order Created',
          description: 'Payment initiated',
          icon: ShoppingCart,
          date: orderData.created_at,
          completed: true,
        },
        {
          id: '2',
          title: 'Payment Locked',
          description: 'Funds in SafePay',
          icon: Lock,
          date: orderData.created_at,
          completed: orderData.escrow_status === 'held' || orderData.escrow_status === 'released',
        },
      ];

      if (trackingData) {
        events.push({
          id: '3',
          title: 'Tracking Added',
          description: `${trackingData.courier_partner}`,
          icon: Truck,
          date: trackingData.created_at,
          completed: true,
        });
      }

      if (trackingData?.status === 'in_transit' || orderData.status === 'shipped') {
        events.push({
          id: '4',
          title: 'In Transit',
          description: 'Package on the way',
          icon: Plane,
          date: trackingData?.shipment_date || orderData.updated_at,
          completed: true,
        });
      }

      if (orderData.status === 'delivered' || orderData.status === 'completed') {
        events.push({
          id: '5',
          title: 'Delivered',
          description: 'Package delivered',
          icon: CheckCircle2,
          date: orderData.delivered_at || orderData.updated_at,
          completed: true,
        });
      }

      if (orderData.status === 'completed' && orderData.escrow_status === 'released') {
        events.push({
          id: '6',
          title: 'Payment Released',
          description: 'Funds transferred',
          icon: Wallet,
          date: orderData.updated_at,
          completed: true,
        });
      }

      if (orderData.status === 'disputed') {
        events.push({
          id: '7',
          title: 'Dispute Raised',
          description: 'Customer dispute',
          icon: Gavel,
          date: orderData.updated_at,
          completed: true,
        });
      }

      setTimeline(events);
    } catch (error) {
      console.error('Error fetching order:', error);
      toast.error('Failed to load order');
    } finally {
      setIsLoading(false);
    }
  }, [orderId, merchant?.id]);

  useEffect(() => {
    fetchOrderDetails();
  }, [fetchOrderDetails]);

  useEffect(() => {
    if (!orderId) return;

    const channel = supabase
      .channel(`order-${orderId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, () => fetchOrderDetails())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_tracking', filter: `order_id=eq.${orderId}` }, () => fetchOrderDetails())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_proofs', filter: `order_id=eq.${orderId}` }, () => fetchOrderDetails())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, fetchOrderDetails]);

  const getStatusBadge = (status: string) => {
    const config: Record<string, { tone: StatusTone; label: string }> = {
      pending: { tone: 'neutral', label: 'Pending' },
      awaiting_shipment: { tone: 'neutral', label: 'Awaiting Shipment' },
      in_transit: { tone: 'info', label: 'In Transit' },
      shipped: { tone: 'info', label: 'Shipped' },
      delivered: { tone: 'info', label: 'Delivered' },
      completed: { tone: 'info', label: 'Completed' },
      disputed: { tone: 'destructive', label: 'Disputed' },
      refunded: { tone: 'neutral', label: 'Refunded' },
    };
    const c = config[status] || { tone: 'neutral' as const, label: status };
    return <StatusBadge tone={c.tone} label={c.label} className="text-xs" />;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
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

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border safe-top">
          <div className="flex items-center h-14 px-4">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-muted rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <Skeleton className="h-5 w-24 ml-2" />
          </div>
        </header>
        <div className="px-4 py-4 space-y-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-36 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Order not found</p>
          <Button onClick={() => navigate('/merchant-orders')}>Back to Orders</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border safe-top">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-muted rounded-full touch-target">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-base font-semibold text-foreground font-mono">{order.public_order_id || `#${order.order_number}`}</h1>
          </div>
          {getStatusBadge(order.status)}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        <div className="px-4 py-4 space-y-3">
          {/* Order Summary */}
          <div className="bg-muted/30 rounded-xl p-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Summary</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Product</span>
                <span className="text-foreground font-medium text-right max-w-[60%] truncate">{order.product_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="text-foreground font-semibold">{formatAmount(order.amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Created</span>
                <span className="text-foreground">{formatDate(order.created_at)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">SafePay</span>
                <StatusBadge
                  tone={order.escrow_status === 'released' ? 'info' : 'neutral'}
                  label={order.escrow_status === 'held' ? 'Held' : order.escrow_status === 'released' ? 'Released' : order.escrow_status}
                  className="text-[10px]"
                />
              </div>
              {order.notes && (
                <div className="pt-2 border-t border-border mt-2">
                  <p className="text-xs text-muted-foreground mb-0.5">Customer Notes</p>
                  <p className="text-sm text-foreground">{order.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Items snapshot (hosted checkout orders) */}
          {items.length > 0 && (
            <div className="bg-muted/30 rounded-xl p-3">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Items</h2>
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.item_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.variant_label && `${item.variant_label} · `}
                        {formatAmount(item.unit_price)} × {item.quantity}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-foreground shrink-0">{formatAmount(item.line_total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="bg-muted/30 rounded-xl p-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Timeline</h2>
            <div className="relative">
              {timeline.map((event, index) => (
                <div key={event.id} className="flex gap-2.5 mb-3 last:mb-0">
                  <div className="relative flex flex-col items-center">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center ${
                        event.completed ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <event.icon className="h-3.5 w-3.5" />
                    </div>
                    {index < timeline.length - 1 && (
                      <div className={`w-0.5 flex-1 mt-1 ${event.completed ? 'bg-primary' : 'bg-border'}`} />
                    )}
                  </div>
                  <div className="flex-1 pb-3">
                    <p className={`text-sm font-medium ${event.completed ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {event.title}
                    </p>
                    {event.description && (
                      <p className="text-xs text-muted-foreground">{event.description}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(event.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tracking Section */}
          <div className="bg-muted/30 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase">Tracking</h2>
              {tracking ? (
                <Link to={`/merchant-edit-tracking/${order.id}`}>
                  <Button size="sm" variant="ghost" className="h-7 text-xs px-2">
                    <Pencil className="h-3.5 w-3.5 mr-0.5" />
                    Edit
                  </Button>
                </Link>
              ) : (
                <Link to={`/merchant-add-tracking/${order.id}`}>
                  <Button size="sm" className="h-7 text-xs px-2">
                    <Plus className="h-3.5 w-3.5 mr-0.5" />
                    Add
                  </Button>
                </Link>
              )}
            </div>
            {tracking ? (
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tracking #</span>
                  <span className="text-foreground font-mono text-xs">{tracking.tracking_number}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Courier</span>
                  <span className="text-foreground">{tracking.courier_partner}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge tone="neutral" label={tracking.status} className="text-[10px]" />
                </div>
                {tracking.estimated_delivery && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Est. Delivery</span>
                    <span className="text-foreground">{formatDate(tracking.estimated_delivery)}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No tracking added yet.</p>
            )}
          </div>

          {/* Delivery Proof Section */}
          <div className="bg-muted/30 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase">Delivery Proof</h2>
              {!deliveryProof && (
                <Link to={`/merchant-delivery-proof/${order.id}`}>
                  <Button size="sm" className="h-7 text-xs px-2">
                    <UploadCloud className="h-3.5 w-3.5 mr-0.5" />
                    Upload
                  </Button>
                </Link>
              )}
            </div>
            {deliveryProof ? (
              <div className="space-y-2">
                <div className="grid grid-cols-4 gap-1.5">
                  {deliveryProof.file_urls.slice(0, 4).map((url, index) => (
                    <a
                      key={index}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="aspect-square rounded-lg bg-muted overflow-hidden"
                    >
                      <img src={url} alt={`Proof ${index + 1}`} className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
                {deliveryProof.delivery_notes && (
                  <p className="text-xs text-muted-foreground">{deliveryProof.delivery_notes}</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No proof uploaded yet.</p>
            )}
          </div>

          {/* Dispute Alert */}
          {order.status === 'disputed' && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <Gavel className="h-[18px] w-[18px] text-destructive" />
                <p className="text-sm font-medium text-destructive">Dispute Active</p>
              </div>
              <p className="text-xs text-destructive/80 mb-2">Customer has raised a dispute on this order.</p>
              <Link to={`/merchant-dispute-response/${order.id}`}>
                <Button size="sm" variant="destructive" className="h-8 text-xs w-full">
                  <Reply className="h-3.5 w-3.5 mr-1" />
                  Respond to Dispute
                </Button>
              </Link>
            </div>
          )}
        </div>
      </main>

      <MerchantBottomNav />
    </div>
  );
}
