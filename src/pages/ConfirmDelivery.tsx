import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Check, Lock, Camera, AlertCircle, ShieldCheck, Package } from 'lucide-react';
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
  amount: number;
  currency: string;
  status: string;
  escrow_status: string;
}

export default function ConfirmDelivery() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [checks, setChecks] = useState({ condition: false, matches: false });

  // Valid statuses for confirmation (escrow must be held)
  const canConfirmStatus = ['pending', 'shipped', 'delivered'].includes(order?.status || '');
  const isEscrowHeld = order?.escrow_status === 'held';

  useEffect(() => {
    const fetchOrder = async () => {
      if (!id || !user?.id) return;
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('id', id)
          .eq('customer_id', user.id)
          .maybeSingle();
        
        if (error) throw error;
        if (!data) { 
          navigate('/orders'); 
          return; 
        }
        
        // Check if order is already completed, disputed, or refunded
        if (['completed', 'disputed', 'refunded', 'cancelled'].includes(data.status)) {
          toast({
            title: 'Cannot Confirm',
            description: `This order is already ${data.status}.`,
            variant: 'destructive',
          });
          navigate(`/orders/${id}`);
          return;
        }
        
        // Check if escrow is not held
        if (data.escrow_status !== 'held') {
          toast({
            title: 'Cannot Confirm',
            description: 'Funds have already been released or refunded.',
            variant: 'destructive',
          });
          navigate(`/orders/${id}`);
          return;
        }
        
        setOrder(data);
      } catch (error) {
        console.error('Error fetching order:', error);
        navigate('/orders');
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrder();
  }, [id, user?.id, navigate, toast]);

  const handleConfirm = async () => {
    if (!order || !checks.condition || !checks.matches || isConfirming) return;
    
    // Double-check order state before confirming
    if (!canConfirmStatus || !isEscrowHeld) {
      toast({
        title: 'Cannot Confirm',
        description: 'Order state has changed. Please refresh.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsConfirming(true);

    try {
      // Use conditional update to prevent race conditions
      const { data: updatedOrder, error: updateError } = await supabase
        .from('orders')
        .update({ 
          status: 'completed', 
          escrow_status: 'released', 
          delivered_at: new Date().toISOString() 
        })
        .eq('id', order.id)
        .eq('escrow_status', 'held') // Only update if still held
        .in('status', ['pending', 'shipped', 'delivered']) // Only update valid statuses
        .select()
        .maybeSingle();
      
      if (updateError) throw updateError;
      
      // Check if update actually happened (row was modified)
      if (!updatedOrder) {
        toast({
          title: 'Already Processed',
          description: 'This order was already confirmed or its status changed.',
          variant: 'destructive',
        });
        navigate(`/orders/${order.id}`);
        return;
      }
      
      await supabase.from('notifications').insert({ 
        user_id: user?.id, 
        type: 'success', 
        title: 'Delivery Confirmed', 
        message: `Funds released to ${order.merchant_name}`, 
        link: `/orders/${order.id}` 
      });
      
      toast({ title: 'Success!', description: 'Funds released to merchant.' });
      navigate(`/orders/${order.id}`);
    } catch (error) {
      console.error('Error confirming delivery:', error);
      toast({ title: 'Error', description: 'Failed to confirm. Try again.', variant: 'destructive' });
    } finally {
      setIsConfirming(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) return null;

  const canConfirm = checks.condition && checks.matches;

  return (
    <div className="mobile-page flex flex-col pb-52 sm:pb-56">
      {/* Header */}
      <header className="sticky-header bg-background">
        <div className="sticky-header-content">
          <button onClick={() => navigate(`/orders/${order.id}`)} className="back-btn">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-sm sm:text-base text-foreground">Confirm Delivery</h1>
          <div className="w-9 shrink-0" />
        </div>
      </header>

      <main className="flex-1 mobile-section space-y-3 sm:space-y-4">
        {/* Order Summary */}
        <div className="info-card p-4 sm:p-5 text-center space-y-3 sm:space-y-4">
          <div className="inline-block">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-muted mx-auto flex items-center justify-center overflow-hidden border-2 border-background shadow-sm">
              {order.merchant_avatar ? (
                <img src={order.merchant_avatar} alt={order.merchant_name} className="w-full h-full object-cover" />
              ) : (
                <Package className="w-6 h-6 sm:w-7 sm:h-7 text-muted-foreground" />
              )}
            </div>
          </div>
          <div>
            <p className="font-bold text-sm sm:text-base text-foreground">{order.merchant_name}</p>
            <Link to={`/orders/${order.id}`} className="text-xs sm:text-sm text-primary font-medium">Order {publicIdOf(order, 'public_order_id', 'ORD', 'order_number')}</Link>
          </div>
          <div>
            <p className="text-base sm:text-lg font-bold text-foreground">{order.product_name}</p>
            <div className="flex items-center justify-center gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
              <span className="text-xl sm:text-2xl font-bold text-success">
                {formatAmount(order.amount, order.currency)}
              </span>
              <span className="bg-success/10 text-success text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full flex items-center gap-0.5 sm:gap-1">
                <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Locked
              </span>
            </div>
          </div>
        </div>

        {/* Checklist */}
        <div className="space-y-2 sm:space-y-3">
          <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Verification Checklist</p>
          
          <label className="list-item cursor-pointer">
            <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-md border-2 flex items-center justify-center transition-colors shrink-0 ${checks.condition ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
              {checks.condition && <Check className="w-3 h-3 sm:w-4 sm:h-4 text-primary-foreground" />}
            </div>
            <input type="checkbox" checked={checks.condition} onChange={(e) => setChecks({ ...checks, condition: e.target.checked })} className="sr-only" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-xs sm:text-sm text-foreground">Item in good condition</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">No visible damages or defects</p>
            </div>
          </label>

          <label className="list-item cursor-pointer">
            <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-md border-2 flex items-center justify-center transition-colors shrink-0 ${checks.matches ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
              {checks.matches && <Check className="w-3 h-3 sm:w-4 sm:h-4 text-primary-foreground" />}
            </div>
            <input type="checkbox" checked={checks.matches} onChange={(e) => setChecks({ ...checks, matches: e.target.checked })} className="sr-only" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-xs sm:text-sm text-foreground">Matches description</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Correct item, color, size, quantity</p>
            </div>
          </label>
        </div>

        {/* Upload Proof (Optional) */}
        <div className="space-y-1.5 sm:space-y-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide">Photo Proof</p>
            <span className="text-[9px] sm:text-xs text-muted-foreground bg-muted px-1.5 sm:px-2 py-0.5 rounded-full">Optional</span>
          </div>
          <button className="w-full h-24 sm:h-32 bg-background border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-1.5 sm:gap-2 hover:border-primary/50 hover:bg-muted/50 transition-colors">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">Tap to upload photo</p>
          </button>
        </div>
      </main>

      {/* Bottom Actions */}
      <div className="bottom-action space-y-2.5 sm:space-y-3">
        {/* Warning */}
        <div className="flex gap-2.5 sm:gap-3 p-2.5 sm:p-3 bg-warning/10 border border-warning/30 rounded-lg sm:rounded-xl">
          <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-warning shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm text-foreground">
            This releases <span className="font-bold">{formatAmount(order.amount, order.currency)}</span> to the merchant. The dispute window closes immediately.
          </p>
        </div>

        {/* Confirm Button */}
        <button
          onClick={handleConfirm}
          disabled={!canConfirm || isConfirming}
          className="bottom-action-btn h-12 sm:h-14 bg-success text-success-foreground disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isConfirming ? (
            <>
              <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-success-foreground border-t-transparent rounded-full animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
              Confirm & Release Funds
            </>
          )}
        </button>

        <p className="text-[10px] sm:text-xs text-muted-foreground text-center">Secured by Safepay</p>
      </div>
    </div>
  );
}
