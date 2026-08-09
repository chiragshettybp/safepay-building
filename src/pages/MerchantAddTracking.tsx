import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Save } from 'lucide-react';
import { FullPageLoading, ButtonSpinner } from '@/components/shared/LoadingSpinner';
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

export default function MerchantAddTracking() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { merchant, isAuthenticated, isLoading: authLoading } = useMerchantAuth();

  const [trackingNumber, setTrackingNumber] = useState('');
  const [courierPartner, setCourierPartner] = useState('');
  const [customCourier, setCustomCourier] = useState('');
  const [shipmentDate, setShipmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [estimatedDelivery, setEstimatedDelivery] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [orderPublicId, setOrderPublicId] = useState('');

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
    const fetchOrder = async () => {
      if (!orderId || !merchant?.id) return;

      const { data, error } = await supabase
        .from('orders')
        .select('order_number, public_order_id, merchant_id')
        .eq('id', orderId)
        .eq('merchant_id', merchant.id)
        .single();

      if (error || !data) {
        toast.error('Order not found');
        navigate('/merchant-orders');
        return;
      }
      
      setOrderNumber(data.order_number);
      setOrderPublicId(data.public_order_id || '');
    };

    fetchOrder();
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

    if (!orderId || !merchant?.id) {
      toast.error('Invalid order');
      return;
    }

    setIsSubmitting(true);

    try {
      const finalCourier = courierPartner === 'Other' ? customCourier.trim() : courierPartner;

      const { error: trackingError } = await supabase.from('order_tracking').insert({
        order_id: orderId,
        merchant_id: merchant.id,
        tracking_number: trackingNumber.trim(),
        courier_partner: finalCourier,
        shipment_date: shipmentDate || null,
        estimated_delivery: estimatedDelivery || null,
        status: 'in_transit',
        notes: notes.trim() || null,
      });

      if (trackingError) {
        if (trackingError.code === '23505') {
          toast.error('Tracking already exists');
        } else {
          throw trackingError;
        }
        return;
      }

      const { error: orderError } = await supabase
        .from('orders')
        .update({ status: 'shipped' })
        .eq('id', orderId);

      if (orderError) throw orderError;

      await supabase.from('merchant_activity').insert({
        merchant_id: merchant.id,
        activity_type: 'tracking',
        title: 'Tracking Added',
        description: `Added tracking for order ${orderPublicId || `#${orderNumber}`}`,
        reference_id: orderId,
        reference_type: 'order',
      });

      toast.success('Tracking added successfully');
      navigate(`/merchant-order/${orderId}`);
    } catch (error) {
      console.error('Error adding tracking:', error);
      toast.error('Failed to add tracking');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || !isAuthenticated || !merchant) {
    return <FullPageLoading />;
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border safe-top">
        <div className="flex items-center h-14 px-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-muted rounded-full touch-target">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold text-foreground ml-2">Add Tracking</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 max-w-lg mx-auto">
          {orderPublicId && (
            <div className="bg-muted/30 rounded-xl p-3 mb-4">
              <p className="text-xs text-muted-foreground">Order</p>
              <p className="text-base font-semibold text-foreground font-mono">{orderPublicId}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
                <ButtonSpinner className="h-4 w-4 mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5 mr-1.5" />
                Save Tracking
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
