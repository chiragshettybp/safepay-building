import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Check, Lock, ChevronDown } from 'lucide-react';
import { toast } from '@/lib/toast';
import { formatAmount } from '@/lib/format';

interface Order {
  id: string;
  public_order_id: string;
  order_number: string;
  merchant_name: string;
  merchant_avatar: string | null;
  merchant?: {
    public_merchant_id: string;
  };
  product_name: string;
  amount: number;
  currency: string;
  status: string;
  escrow_status: string;
}

const issueCategories = [
  { value: '', label: 'Select a reason' },
  { value: 'not_received', label: 'Item not received' },
  { value: 'not_as_described', label: 'Item not as described' },
  { value: 'damaged', label: 'Item arrived damaged' },
  { value: 'wrong_amount', label: 'Charged wrong amount' },
  { value: 'service_not_provided', label: 'Service not provided' },
  { value: 'other', label: 'Other' },
];

export default function RaiseDispute() {
  const { orderId } = useParams<{ orderId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [issueType, setIssueType] = useState('');
  const [description, setDescription] = useState('');
  const [merchantNotResponded, setMerchantNotResponded] = useState(false);

  useEffect(() => {
    const fetchOrderAndCheckDispute = async () => {
      if (!orderId || !user?.id) return;
      try {
        // Fetch order
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('*, merchant:merchants(public_merchant_id)')
          .eq('id', orderId)
          .eq('customer_id', user.id)
          .maybeSingle();
        
        if (orderError) throw orderError;
        if (!orderData) {
          navigate('/orders');
          return;
        }
        
        // Check if order is already completed - can't dispute completed orders
        if (orderData.status === 'completed') {
          toast({
            title: 'Cannot Dispute',
            description: 'This order has already been completed and funds released.',
            variant: 'destructive',
          });
          navigate(`/orders/${orderId}`);
          return;
        }
        
        // Check if order already has an active dispute
        const { data: existingDispute, error: disputeError } = await supabase
          .from('disputes')
          .select('id, status')
          .eq('order_id', orderId)
          .not('status', 'in', '("closed","rejected")')
          .maybeSingle();
        
        if (disputeError && disputeError.code !== 'PGRST116') {
          throw disputeError;
        }
        
        if (existingDispute) {
          toast({
            title: 'Dispute Already Exists',
            description: 'There is already an active dispute for this order.',
            variant: 'destructive',
          });
          navigate(`/disputes/${existingDispute.id}`);
          return;
        }
        
        setOrder(orderData);
      } catch (error) {
        console.error('Error fetching order:', error);
        navigate('/orders');
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrderAndCheckDispute();
  }, [orderId, user?.id, navigate]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleContinue = async () => {
    if (!order || !user?.id || !issueType || !description.trim() || isSubmitting) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsSubmitting(true);

    try {
      // Double-check for existing dispute before creating
      const { data: existingDispute } = await supabase
        .from('disputes')
        .select('id')
        .eq('order_id', order.id)
        .not('status', 'in', '("closed","rejected")')
        .maybeSingle();
      
      if (existingDispute) {
        toast({
          title: 'Dispute Already Exists',
          description: 'A dispute was already created for this order.',
          variant: 'destructive',
        });
        navigate(`/disputes/${existingDispute.id}`);
        return;
      }
      
      // Also verify order is still disputable
      const { data: currentOrder } = await supabase
        .from('orders')
        .select('status')
        .eq('id', order.id)
        .single();
      
      if (currentOrder?.status === 'completed') {
        toast({
          title: 'Cannot Dispute',
          description: 'This order was completed while you were filling the form.',
          variant: 'destructive',
        });
        navigate(`/orders/${order.id}`);
        return;
      }
      
      // Create the dispute
      const { data: dispute, error } = await supabase
        .from('disputes')
        .insert({
          order_id: order.id,
          customer_id: user.id,
          reason: issueCategories.find(c => c.value === issueType)?.label || issueType,
          issue_type: issueType,
          description: description,
          merchant_not_responded: merchantNotResponded,
          status: 'open',
        })
        .select()
        .single();

      if (error) {
        // Handle unique constraint violation
        if (error.code === '23505') {
          toast({
            title: 'Dispute Already Exists',
            description: 'A dispute already exists for this order.',
            variant: 'destructive',
          });
          navigate('/disputes');
          return;
        }
        throw error;
      }

      // Create initial timeline update
      await supabase.from('dispute_updates').insert({
        dispute_id: dispute.id,
        title: 'Dispute Submitted',
        description: "We've received your request",
        update_type: 'status_change',
        actor_type: 'system',
      });

      // Update order status (triggers customer + merchant notifications)
      await supabase
        .from('orders')
        .update({ status: 'disputed' })
        .eq('id', order.id);

      toast({
        title: 'Dispute Created',
        description: 'Now upload supporting evidence.',
      });

      // Navigate to upload proof page
      navigate(`/disputes/${dispute.id}/upload`);
    } catch (error) {
      console.error('Error creating dispute:', error);
      toast({
        title: 'Error',
        description: 'Failed to create dispute. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canContinue = issueType && description.trim().length >= 20;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="mobile-page font-sans text-foreground antialiased flex flex-col pb-32 sm:pb-36">
      {/* Header Navigation */}
      <header className="sticky-header bg-surface">
        <div className="sticky-header-content px-4">
          <button 
            onClick={() => navigate(`/orders/${order.id}`)}
            className="back-btn flex items-center text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ArrowLeft className="w-5 h-5 mr-1 group-hover:-translate-x-1 transition-transform" />
            <span className="text-xs sm:text-sm font-medium truncate">Order {order.public_order_id || `#${order.order_number}`}</span>
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-4 sm:px-6 pt-2 pb-4 sm:pb-6 flex flex-col items-center">
        <h1 className="text-destructive text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-center mb-3 sm:mb-4">
          Raise Dispute
        </h1>
        {/* Order Summary Badge */}
        <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-border/50 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium text-foreground shadow-sm border border-border flex-wrap justify-center">
          <span className="truncate max-w-[100px] sm:max-w-none">{order.merchant_name}</span>
          <span className="w-1 h-1 rounded-full bg-muted-foreground shrink-0"></span>
          <span className="shrink-0">{formatAmount(order.amount, order.currency)}</span>
          <span className="w-1 h-1 rounded-full bg-muted-foreground shrink-0"></span>
          <span className="text-muted-foreground capitalize shrink-0">{order.status.replace('_', ' ')}</span>
        </div>
      </section>

      {/* Main Content Stack */}
      <main className="flex flex-col gap-5 sm:gap-8 px-4 sm:px-6 w-full max-w-lg mx-auto">
        {/* Order Summary Card */}
        <div className="bg-background rounded-2xl sm:rounded-3xl shadow-subtle border border-border/60 p-4 sm:p-6 md:p-8 flex flex-col gap-4 sm:gap-5 relative overflow-hidden">
          {/* Decorative gradient */}
          <div className="absolute top-0 right-0 w-24 sm:w-32 h-24 sm:h-32 bg-gradient-to-br from-primary/5 to-transparent rounded-bl-[40px] sm:rounded-bl-[60px] -z-0"></div>
          
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="relative mb-2 sm:mb-3">
              <img
                alt={order.merchant_name}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-3 sm:border-4 border-surface shadow-md"
                src={order.merchant_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(order.merchant_name)}&background=3B82F6&color=fff&size=80`}
              />
              <div className="absolute -bottom-1 -right-1 bg-success text-white rounded-full p-0.5 sm:p-1 border-2 border-surface flex items-center justify-center">
                <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              </div>
            </div>
            
            <h3 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-1 sm:gap-1.5 mb-0.5 sm:mb-1">
              {order.merchant_name}
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-success" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
              </svg>
            </h3>
            
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-surface border border-border text-[10px] sm:text-xs font-medium text-muted-foreground mb-3 sm:mb-4">
              {order.merchant?.public_merchant_id || `MERC-${order.order_number.slice(-3)}`}
            </span>
            
            <div className="w-full h-px bg-border/60 mb-3 sm:mb-4"></div>
            
            <div className="flex flex-col gap-1 w-full text-left">
              <div className="flex justify-between items-start gap-2">
                <p className="text-sm sm:text-lg text-foreground font-semibold truncate flex-1">{order.product_name}</p>
                <span className="bg-warning/10 text-warning text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded-full border border-warning/20 whitespace-nowrap shrink-0">
                  Dispute Eligible
                </span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 mt-1">
                <p className="text-primary text-2xl sm:text-3xl font-extrabold tracking-tight">
                  {formatAmount(order.amount, order.currency)}
                </p>
                {order.escrow_status === 'held' && (
                  <div className="flex items-center gap-0.5 sm:gap-1 text-primary bg-primary/5 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-xs font-bold">
                    <span>Locked</span>
                    <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Dispute Form */}
        <form className="flex flex-col gap-5 sm:gap-8" onSubmit={(e) => e.preventDefault()}>
          {/* Issue Category */}
          <div className="flex flex-col gap-1.5 sm:gap-2">
            <label className="text-xs sm:text-sm font-medium text-foreground flex items-center gap-1" htmlFor="issue-category">
              What is the issue? <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <select
                id="issue-category"
                value={issueType}
                onChange={(e) => setIssueType(e.target.value)}
                className="mobile-input appearance-none w-full h-12 sm:h-[60px] pr-12"
              >
                {issueCategories.map((cat) => (
                  <option key={cat.value} value={cat.value} disabled={cat.value === ''}>
                    {cat.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5 sm:gap-2">
            <div className="flex justify-between items-end">
              <label className="text-xs sm:text-sm font-medium text-foreground flex items-center gap-1" htmlFor="description">
                Describe the problem <span className="text-destructive">*</span>
              </label>
              <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">{description.length}/500</span>
            </div>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              placeholder="Tell us more details about the dispute... Be as specific as possible to help us resolve this quickly."
              className="mobile-input w-full min-h-[160px] sm:min-h-[200px] p-3 sm:p-4 resize-none"
            />
            {description.length > 0 && description.length < 20 && (
              <p className="text-[10px] sm:text-xs text-destructive flex items-center gap-1">
                Minimum 20 characters required
              </p>
            )}
          </div>

          {/* Checkbox */}
          <label className="flex items-start gap-3 p-1 cursor-pointer group">
            <div className="relative flex items-center mt-0.5">
              <input
                type="checkbox"
                checked={merchantNotResponded}
                onChange={(e) => setMerchantNotResponded(e.target.checked)}
                className="peer h-6 w-6 rounded border-2 border-muted-foreground text-primary focus:ring-4 focus:ring-primary/20 focus:ring-offset-0 transition-all checked:bg-success checked:border-success appearance-none cursor-pointer"
              />
              {merchantNotResponded && (
                <Check className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-white pointer-events-none" />
              )}
            </div>
            <span className="text-sm text-muted-foreground leading-snug group-hover:text-foreground transition-colors">
              I confirm that the merchant did not respond to my messages regarding this issue. <span className="text-destructive">*</span>
            </span>
          </label>
        </form>
      </main>

      {/* Sticky Bottom Bar */}
      <div className="bottom-action">
        <div className="max-w-lg mx-auto w-full">
          <button
            onClick={handleContinue}
            disabled={!canContinue || isSubmitting}
            className="bottom-action-btn h-14 sm:h-[72px] bg-primary hover:bg-primary/90 text-white text-sm sm:text-lg font-bold shadow-lg shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <span>Continue to Upload Proof</span>
                <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6 rotate-180" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
