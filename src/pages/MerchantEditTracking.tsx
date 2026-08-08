import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const COURIER_PARTNERS = [
  'Delhivery',
  'Blue Dart',
  'DTDC',
  'Ecom Express',
  'Ekart',
  'FedEx',
  'India Post',
  'Professional Couriers',
  'Shadowfax',
  'Shiprocket',
  'XpressBees',
  'Other',
];

const TRACKING_STATUSES = [
  { value: 'pending', label: 'Pending Pickup' },
  { value: 'picked_up', label: 'Picked Up' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'failed_delivery', label: 'Failed Delivery' },
  { value: 'returned', label: 'Returned' },
];

export default function MerchantEditTracking() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { merchant, isAuthenticated, isLoading: authLoading } = useMerchantAuth();

  const [trackingId, setTrackingId] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [courierPartner, setCourierPartner] = useState('');
  const [customCourier, setCustomCourier] = useState('');
  const [shipmentDate, setShipmentDate] = useState('');
  const [estimatedDelivery, setEstimatedDelivery] = useState('');
  const [status, setStatus] = useState('in_transit');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');

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

  useEffect(() => {
    const fetchTracking = async () => {
      if (!orderId || !merchant?.id) return;

      try {
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('order_number, merchant_id')
          .eq('id', orderId)
          .eq('merchant_id', merchant.id)
          .single();

        if (orderError || !orderData) {
          toast.error('Order not found');
          navigate('/merchant-orders');
          return;
        }
        
        setOrderNumber(orderData.order_number);

        const { data: trackingData, error } = await supabase
          .from('order_tracking')
          .select('*')
          .eq('order_id', orderId)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            toast.error('No tracking found');
            navigate(`/merchant-add-tracking/${orderId}`);
            return;
          }
          throw error;
        }

        setTrackingId(trackingData.id);
        setTrackingNumber(trackingData.tracking_number);
        setStatus(trackingData.status);
        setNotes(trackingData.notes || '');

        if (COURIER_PARTNERS.includes(trackingData.courier_partner)) {
          setCourierPartner(trackingData.courier_partner);
        } else {
          setCourierPartner('Other');
          setCustomCourier(trackingData.courier_partner);
        }

        if (trackingData.shipment_date) {
          setShipmentDate(trackingData.shipment_date.split('T')[0]);
        }
        if (trackingData.estimated_delivery) {
          setEstimatedDelivery(trackingData.estimated_delivery.split('T')[0]);
        }
      } catch (error) {
        console.error('Error fetching tracking:', error);
        toast.error('Failed to load tracking');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTracking();
  }, [orderId, merchant?.id, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!trackingNumber.trim()) {
      toast.error('Enter tracking number');
      return;
    }

    if (!courierPartner) {
      toast.error('Select courier partner');
      return;
    }

    if (courierPartner === 'Other' && !customCourier.trim()) {
      toast.error('Enter courier name');
      return;
    }

    if (!trackingId || !orderId || !merchant?.id) {
      toast.error('Invalid tracking');
      return;
    }

    setIsSubmitting(true);

    try {
      const finalCourier = courierPartner === 'Other' ? customCourier.trim() : courierPartner;

      const { error: trackingError } = await supabase
        .from('order_tracking')
        .update({
          tracking_number: trackingNumber.trim(),
          courier_partner: finalCourier,
          shipment_date: shipmentDate || null,
          estimated_delivery: estimatedDelivery || null,
          status: status,
          notes: notes.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', trackingId);

      if (trackingError) throw trackingError;

      await supabase.from('tracking_updates').insert({
        tracking_id: trackingId,
        status: status,
        description: `Status updated to ${status}`,
        updated_by: 'merchant',
      });

      if (status === 'delivered') {
        await supabase
          .from('orders')
          .update({ status: 'delivered', delivered_at: new Date().toISOString() })
          .eq('id', orderId);
      } else if (status === 'in_transit' || status === 'out_for_delivery') {
        await supabase
          .from('orders')
          .update({ status: 'shipped' })
          .eq('id', orderId);
      }

      await supabase.from('merchant_activity').insert({
        merchant_id: merchant.id,
        activity_type: 'tracking',
        title: 'Tracking Updated',
        description: `Updated tracking for order #${orderNumber}`,
        reference_id: orderId,
        reference_type: 'order',
      });

      toast.success('Tracking updated');
      navigate(`/merchant-order/${orderId}`);
    } catch (error) {
      console.error('Error updating tracking:', error);
      toast.error('Failed to update');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || !isAuthenticated || !merchant) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border safe-top">
          <div className="flex items-center h-14 px-4">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-muted rounded-full">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <Skeleton className="h-5 w-28 ml-2" />
          </div>
        </header>
        <div className="px-4 py-4 max-w-lg mx-auto space-y-4">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
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
        <div className="flex items-center h-14 px-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-muted rounded-full touch-target">
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <h1 className="text-lg font-semibold text-foreground ml-2">Edit Tracking</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 max-w-lg mx-auto">
          {orderNumber && (
            <div className="bg-muted/30 rounded-xl p-3 mb-4">
              <p className="text-xs text-muted-foreground">Order</p>
              <p className="text-base font-semibold text-foreground">#{orderNumber}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="status" className="text-sm">Shipment Status *</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRACKING_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="trackingNumber" className="text-sm">Tracking Number *</Label>
              <Input
                id="trackingNumber"
                type="text"
                placeholder="Enter tracking number"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="h-11"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="courier" className="text-sm">Courier Partner *</Label>
              <Select value={courierPartner} onValueChange={setCourierPartner}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select courier" />
                </SelectTrigger>
                <SelectContent>
                  {COURIER_PARTNERS.map((courier) => (
                    <SelectItem key={courier} value={courier}>
                      {courier}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {courierPartner === 'Other' && (
              <div className="space-y-1.5">
                <Label htmlFor="customCourier" className="text-sm">Courier Name *</Label>
                <Input
                  id="customCourier"
                  type="text"
                  placeholder="Enter courier name"
                  value={customCourier}
                  onChange={(e) => setCustomCourier(e.target.value)}
                  className="h-11"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="shipmentDate" className="text-sm">Shipment Date</Label>
                <Input
                  id="shipmentDate"
                  type="date"
                  value={shipmentDate}
                  onChange={(e) => setShipmentDate(e.target.value)}
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="estimatedDelivery" className="text-sm">Est. Delivery</Label>
                <Input
                  id="estimatedDelivery"
                  type="date"
                  value={estimatedDelivery}
                  onChange={(e) => setEstimatedDelivery(e.target.value)}
                  min={shipmentDate}
                  className="h-11"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-sm">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
          </form>
        </div>
      </main>

      {/* Bottom Action */}
      <div className="sticky bottom-0 bg-background border-t border-border p-4 safe-bottom">
        <div className="flex gap-3 max-w-lg mx-auto">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(-1)}
            className="flex-1 h-11"
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="flex-1 h-11" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent mr-2" />
                Saving...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm mr-1.5">save</span>
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
