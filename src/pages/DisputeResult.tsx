import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ArrowLeft, Check, Download, ShoppingBag, Copy, Flag, HelpCircle, Clock, Image, FileText, IndianRupee, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Dispute {
  id: string;
  public_dispute_id: string;
  order_id: string;
  reason: string;
  issue_type: string | null;
  description: string | null;
  status: string;
  resolution: string | null;
  refund_amount: number | null;
  refund_transaction_id: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

interface DisputeUpdate {
  id: string;
  dispute_id: string;
  title: string;
  description: string | null;
  update_type: string;
  actor_type: string;
  created_at: string;
}

interface DisputeFile {
  id: string;
  file_name: string;
  file_type: string;
}

type VerdictType = 'customer_won' | 'merchant_won' | 'partial_refund';

const verdictConfig: Record<VerdictType, { color: string; bgColor: string; label: string; icon: React.ReactNode }> = {
  customer_won: { 
    color: 'text-success', 
    bgColor: 'bg-success', 
    label: 'Customer Won', 
    icon: <Check className="w-12 h-12" /> 
  },
  merchant_won: { 
    color: 'text-destructive', 
    bgColor: 'bg-destructive', 
    label: 'Merchant Won', 
    icon: <X className="w-12 h-12" /> 
  },
  partial_refund: { 
    color: 'text-warning', 
    bgColor: 'bg-warning', 
    label: 'Partial Refund', 
    icon: <IndianRupee className="w-12 h-12" /> 
  },
};

export default function DisputeResult() {
  const { disputeId } = useParams<{ disputeId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [updates, setUpdates] = useState<DisputeUpdate[]>([]);
  const [files, setFiles] = useState<DisputeFile[]>([]);
  const [refundId, setRefundId] = useState<string | null>(null);
  const [refundPublicId, setRefundPublicId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showToast, setShowToast] = useState(true);

  // Create or fetch refund when customer wins
  const createOrFetchRefund = async (disputeData: Dispute) => {
    if (!user?.id) return;
    
    // Only create refund for customer wins or partial refunds with amount
    const resolution = disputeData.resolution?.toLowerCase() || '';
    const customerWon = !resolution.includes('merchant');
    if (!customerWon || !disputeData.refund_amount) return;

    try {
      // Check if refund already exists for this dispute
      const { data: existingRefund } = await supabase
        .from('refunds')
        .select('id, public_refund_id')
        .eq('dispute_id', disputeData.id)
        .maybeSingle();

      if (existingRefund) {
        setRefundId(existingRefund.id);
        setRefundPublicId(existingRefund.public_refund_id);
        return;
      }

      // Create new refund
      const { data: newRefund, error: refundError } = await supabase
        .from('refunds')
        .insert({
          order_id: disputeData.order_id,
          customer_id: user.id,
          dispute_id: disputeData.id,
          amount: disputeData.refund_amount,
          currency: 'INR',
          reason: 'dispute_won',
          status: 'initiated'
        })
        .select('id, public_refund_id')
        .single();

      if (refundError) {
        if (refundError.code === '23505') {
          const { data: existing } = await supabase
            .from('refunds')
            .select('id, public_refund_id')
            .eq('dispute_id', disputeData.id)
            .maybeSingle();
          if (existing) {
            setRefundId(existing.id);
            setRefundPublicId(existing.public_refund_id);
            return;
          }
        }
        console.error('Error creating refund:', refundError);
        return;
      }

      setRefundId(newRefund.id);
      setRefundPublicId(newRefund.public_refund_id);

      // Create initial refund event
      await supabase.from('refund_events').insert({
        refund_id: newRefund.id,
        title: 'Refund Initiated',
        description: 'Refund created from dispute resolution',
        event_type: 'status_change',
        status: 'pending'
      });

    } catch (error) {
      console.error('Error in refund creation:', error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!disputeId || !user?.id) return;
      
      try {
        const { data: disputeData, error: disputeError } = await supabase
          .from('disputes')
          .select('*')
          .eq('id', disputeId)
          .eq('customer_id', user.id)
          .maybeSingle();
        
        if (disputeError) throw disputeError;
        if (!disputeData) {
          navigate('/orders');
          return;
        }
        setDispute(disputeData);

        // Create or fetch refund if customer won
        await createOrFetchRefund(disputeData);

        // Fetch timeline
        const { data: updatesData } = await supabase
          .from('dispute_updates')
          .select('*')
          .eq('dispute_id', disputeId)
          .order('created_at', { ascending: false });
        setUpdates(updatesData || []);

        // Fetch files count
        const { data: filesData } = await supabase
          .from('dispute_files')
          .select('id, file_name, file_type')
          .eq('dispute_id', disputeId)
          .limit(5);
        setFiles(filesData || []);

      } catch (error) {
        console.error('Error fetching data:', error);
        navigate('/orders');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();

    // Auto-hide toast after 5 seconds
    const timer = setTimeout(() => setShowToast(false), 5000);
    return () => clearTimeout(timer);
  }, [disputeId, user?.id, navigate]);

  const copyTransactionId = () => {
    const txnId = refundPublicId || dispute?.refund_transaction_id;
    if (txnId) {
      navigator.clipboard.writeText(txnId);
      toast({ title: 'Copied!', description: 'Refund ID copied to clipboard' });
    }
  };

  // Determine verdict type based on resolution
  const getVerdictType = (): VerdictType => {
    if (!dispute?.resolution) return 'customer_won';
    if (dispute.resolution.toLowerCase().includes('merchant')) return 'merchant_won';
    if (dispute.resolution.toLowerCase().includes('partial')) return 'partial_refund';
    return 'customer_won';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!dispute) return null;

  const verdictType = getVerdictType();
  const verdict = verdictConfig[verdictType];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-x-hidden">
      {/* Confetti Background */}
      {verdictType === 'customer_won' && (
        <div 
          className="absolute inset-0 h-[400px] w-full pointer-events-none z-0 opacity-20"
          style={{
            backgroundImage: 'radial-gradient(hsl(var(--success)) 1px, transparent 1px), radial-gradient(hsl(var(--primary)) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 10px 10px',
          }}
        />
      )}

      {/* Top Navigation */}
      <nav className="flex items-center justify-between p-4 sticky top-0 bg-background/90 backdrop-blur-md z-50 border-b border-border/50">
        <button 
          onClick={() => navigate(`/orders/${dispute.order_id}`)}
          className="flex items-center justify-center p-2 rounded-full hover:bg-muted text-foreground transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h2 className="text-base font-semibold text-foreground tracking-tight">
          {dispute.public_dispute_id || `Dispute #${dispute.id.slice(0, 5).toUpperCase()}`}
        </h2>
        <button className="flex items-center justify-center p-2 rounded-full text-primary font-medium hover:bg-primary/10 transition-colors text-sm">
          <HelpCircle className="w-5 h-5" />
        </button>
      </nav>

      {/* Scrollable Content */}
      <main className="flex-1 flex flex-col pb-28 relative">
        {/* Verdict Section */}
        <section className="relative z-10 pt-8 pb-4 px-6 text-center flex flex-col items-center">
          <div className="mb-4 relative">
            <div className={`w-20 h-20 rounded-full ${verdict.bgColor}/10 flex items-center justify-center relative animate-pulse`}>
              <span className={`${verdict.color} font-bold`}>{verdict.icon}</span>
            </div>
            {verdictType === 'customer_won' && (
              <>
                <div className="absolute -top-1 -right-2 text-warning">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                </div>
                <div className="absolute -bottom-1 -left-2 text-primary">
                  <div className="w-2 h-2 rounded-full bg-current" />
                </div>
              </>
            )}
          </div>
          
          <h1 className={`text-4xl font-extrabold tracking-tight mb-2 ${verdict.color}`}>
            {verdict.label}
          </h1>
          
          {dispute.refund_amount && (
            <p className="text-foreground text-xl font-bold leading-tight tracking-tight">
              Full refund ₹{Number(dispute.refund_amount).toLocaleString()} processed
            </p>
          )}
        </section>

        {/* Resolution Summary Card */}
        <section className="px-4 py-4 z-10">
          <div className="bg-surface rounded-2xl p-6 shadow-subtle border border-border">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-muted-foreground text-sm font-medium mb-1">Decision</p>
                <p className="text-foreground text-lg font-semibold leading-snug">
                  {dispute.resolution || 'Admin reviewed evidence & tracking.'}
                </p>
              </div>
            </div>

            {dispute.refund_amount && (
              <div className="my-6">
                <p className="text-muted-foreground text-sm font-medium mb-1">Refund Amount</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-success text-4xl leading-none font-extrabold tracking-tight">
                    ₹{Number(dispute.refund_amount).toLocaleString()}
                  </span>
                </div>
                {dispute.refund_transaction_id && (
                  <div className="flex items-center mt-2 gap-2">
                    <span className="bg-muted px-2 py-1 rounded text-xs font-mono text-muted-foreground">
                      {refundPublicId || `TXN #${dispute.refund_transaction_id}`}
                    </span>
                    <button 
                      onClick={copyTransactionId}
                      className="text-primary hover:text-primary/80 transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 mb-5">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <p className="text-muted-foreground text-sm font-medium">
                Resolved {dispute.resolved_at ? format(new Date(dispute.resolved_at), 'dd MMM HH:mm') : format(new Date(dispute.updated_at), 'dd MMM HH:mm')}
              </p>
            </div>

            {/* Admin Quote */}
            {dispute.admin_notes && (
              <div className="bg-background rounded-xl p-4 border border-border/60 relative">
                <div className="absolute -top-3 left-4 bg-background px-2 py-0.5 rounded-full border border-border/60 flex items-center gap-1 shadow-sm">
                  <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center text-[10px] text-white font-bold">A</div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Admin Note</span>
                </div>
                <p className="text-foreground/80 italic text-sm leading-relaxed pt-2">
                  "{dispute.admin_notes}"
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Timeline Section */}
        <section className="px-4 py-4 z-10">
          <h3 className="text-lg font-bold text-foreground mb-4 px-2">Dispute History</h3>
          <div className="flex flex-col gap-0">
            {updates.map((update, index) => {
              const isFirst = index === 0;
              const isLast = index === updates.length - 1;
              
              let iconBg = 'bg-background';
              let iconContent = <Flag className="w-5 h-5 text-muted-foreground" />;
              
              if (update.title.includes('Resolved')) {
                iconBg = 'bg-success';
                iconContent = <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>;
              } else if (update.title.includes('Review')) {
                iconContent = (
                  <div 
                    className="w-full h-full rounded-full bg-cover bg-center"
                    style={{ backgroundImage: `url(https://ui-avatars.com/api/?name=Admin&background=3B82F6&color=fff&size=48)` }}
                  />
                );
              } else if (update.title.includes('Evidence')) {
                iconContent = (
                  <div 
                    className="w-full h-full rounded-full bg-cover bg-center"
                    style={{ backgroundImage: `url(https://ui-avatars.com/api/?name=You&background=10B981&color=fff&size=48)` }}
                  />
                );
              }

              return (
                <div key={update.id} className="flex gap-4 relative pb-8">
                  <div className="flex flex-col items-center shrink-0 w-12 relative z-10">
                    <div className={`w-12 h-12 rounded-full ${iconBg} flex items-center justify-center shadow-md border-2 border-background ring-1 ring-border overflow-hidden`}>
                      {iconContent}
                    </div>
                    {!isLast && (
                      <div className="absolute top-12 left-1/2 -translate-x-1/2 w-0.5 h-[calc(100%-48px)] bg-border" />
                    )}
                  </div>
                  <div className={`flex-1 ${isFirst ? 'bg-surface shadow-card' : 'bg-background'} rounded-xl p-4 border border-border`}>
                    <div className="flex justify-between items-start mb-1">
                      <p className="font-bold text-foreground">{update.title}</p>
                      <span className="text-xs text-muted-foreground bg-background px-1.5 py-0.5 rounded border border-border">
                        {format(new Date(update.created_at), 'dd MMM')}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{update.description}</p>
                    {update.actor_type !== 'customer' && update.actor_type !== 'system' && (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold border border-primary/20">A</div>
                        <span className="text-xs font-medium text-muted-foreground">Safepay Admin</span>
                      </div>
                    )}
                    {update.update_type === 'evidence' && files.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto pb-2 mt-3">
                        {files.slice(0, 2).map((file) => (
                          <div key={file.id} className="w-16 h-16 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
                            {file.file_type.startsWith('image/') ? (
                              <Image className="w-5 h-5 text-muted-foreground" />
                            ) : (
                              <FileText className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="h-8"></div>
      </main>

      {/* Sticky Triple Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 h-[88px] bg-background border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-40 px-4 pb-4 pt-3">
        <div className="flex justify-between items-center h-full gap-3">
          {/* Action: Refund */}
          <button 
            onClick={() => refundId ? navigate(`/refunds/${refundId}`) : navigate('/refunds')}
            className="flex flex-col items-center justify-center flex-1 h-16 rounded-xl hover:bg-success/5 active:bg-success/10 transition-colors group"
          >
            <div className="w-8 h-8 flex items-center justify-center rounded-full bg-success/10 text-success mb-1 group-active:scale-95 transition-transform">
              <IndianRupee className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-success tracking-wide">
              {refundId ? 'View Refund' : 'Refunds'}
            </span>
          </button>
          
          {/* Separator */}
          <div className="w-px h-8 bg-border"></div>
          
          {/* Action: PDF */}
          <button className="flex flex-col items-center justify-center flex-1 h-16 rounded-xl hover:bg-primary/5 active:bg-primary/10 transition-colors group">
            <div className="w-8 h-8 flex items-center justify-center rounded-full bg-primary/10 text-primary mb-1 group-active:scale-95 transition-transform">
              <Download className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-primary tracking-wide">PDF</span>
          </button>
          
          {/* Separator */}
          <div className="w-px h-8 bg-border"></div>
          
          {/* Action: Orders */}
          <button 
            onClick={() => navigate('/orders')}
            className="flex flex-col items-center justify-center flex-1 h-16 rounded-xl hover:bg-muted active:bg-muted/80 transition-colors group"
          >
            <div className="w-8 h-8 flex items-center justify-center rounded-full bg-muted text-muted-foreground mb-1 group-active:scale-95 transition-transform">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-muted-foreground tracking-wide">Orders</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-20 left-4 right-4 z-50 animate-slide-in">
          <div className="bg-foreground/90 backdrop-blur text-background px-4 py-3 rounded-xl shadow-xl flex items-center justify-between border border-border/10">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
              <p className="text-sm font-medium">Dispute finalized successfully</p>
            </div>
            <button 
              onClick={() => setShowToast(false)}
              className="text-background/60 hover:text-background"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
