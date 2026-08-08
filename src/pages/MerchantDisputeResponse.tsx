import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface Dispute {
  id: string;
  order_id: string;
  customer_id: string;
  reason: string;
  description: string | null;
  issue_type: string | null;
  status: string;
  resolution: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Order {
  id: string;
  order_number: string;
  product_name: string;
  amount: number;
  status: string;
  created_at: string;
}

interface DisputeUpdate {
  id: string;
  title: string;
  description: string | null;
  actor_type: string;
  created_at: string;
}

interface DisputeComment {
  id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
}

interface DisputeFile {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
}

export default function MerchantDisputeResponse() {
  const navigate = useNavigate();
  const { disputeId } = useParams<{ disputeId: string }>();
  const { merchant, isAuthenticated, isLoading: authLoading } = useMerchantAuth();
  
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [updates, setUpdates] = useState<DisputeUpdate[]>([]);
  const [comments, setComments] = useState<DisputeComment[]>([]);
  const [files, setFiles] = useState<DisputeFile[]>([]);
  const [customerName, setCustomerName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [responseText, setResponseText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/merchant-login', { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  const fetchDisputeData = useCallback(async () => {
    if (!disputeId || !merchant?.id) return;

    try {
      const { data: disputeData, error: disputeError } = await supabase
        .from('disputes')
        .select('*')
        .eq('id', disputeId)
        .single();

      if (disputeError) throw disputeError;
      setDispute(disputeData);

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*, merchant_id')
        .eq('id', disputeData.order_id)
        .returns<(Order & { merchant_id: string })[]>()
        .single();

      if (orderError) throw orderError;
      setOrder(orderData);

      if ((orderData as any).merchant_id !== merchant.id) {
        toast.error('Access denied');
        navigate('/merchant-disputes');
        return;
      }

      const { data: customerData } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', disputeData.customer_id)
        .single();
      
      setCustomerName(customerData?.full_name || 'Unknown');

      const { data: updatesData } = await supabase
        .from('dispute_updates')
        .select('*')
        .eq('dispute_id', disputeId)
        .order('created_at', { ascending: true });

      setUpdates(updatesData || []);

      const { data: commentsData } = await supabase
        .from('dispute_comments')
        .select('*')
        .eq('dispute_id', disputeId)
        .order('created_at', { ascending: true });

      setComments(commentsData || []);

      const { data: filesData } = await supabase
        .from('dispute_files')
        .select('*')
        .eq('dispute_id', disputeId)
        .order('created_at', { ascending: true });

      setFiles(filesData || []);

    } catch (error) {
      console.error('Error fetching dispute:', error);
      toast.error('Failed to load dispute');
    } finally {
      setIsLoading(false);
    }
  }, [disputeId, merchant?.id, navigate]);

  useEffect(() => {
    fetchDisputeData();
  }, [fetchDisputeData]);

  useEffect(() => {
    if (!disputeId) return;

    const channel = supabase
      .channel(`merchant-dispute-${disputeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'disputes', filter: `id=eq.${disputeId}` }, () => fetchDisputeData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dispute_updates', filter: `dispute_id=eq.${disputeId}` }, () => fetchDisputeData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dispute_comments', filter: `dispute_id=eq.${disputeId}` }, () => fetchDisputeData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dispute_files', filter: `dispute_id=eq.${disputeId}` }, () => fetchDisputeData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [disputeId, fetchDisputeData]);

  const handleSubmitResponse = async () => {
    if (!responseText.trim() || !disputeId || !merchant) {
      toast.error('Enter a response');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error: commentError } = await supabase
        .from('dispute_comments')
        .insert({
          dispute_id: disputeId,
          message: responseText.trim(),
          user_id: merchant.id,
          is_admin: false,
        });

      if (commentError) throw commentError;

      const { error: updateError } = await supabase
        .from('dispute_updates')
        .insert({
          dispute_id: disputeId,
          title: 'Merchant Response',
          description: 'Merchant submitted a response',
          update_type: 'response',
          actor_type: 'merchant',
        });

      if (updateError) throw updateError;

      const { error: disputeUpdateError } = await supabase
        .from('disputes')
        .update({
          status: 'under_review',
          merchant_not_responded: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', disputeId);

      if (disputeUpdateError) throw disputeUpdateError;

      setResponseText('');
      toast.success('Response submitted');
      
    } catch (error) {
      console.error('Error submitting response:', error);
      toast.error('Failed to submit');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      pending: { variant: 'secondary', label: 'Pending' },
      under_review: { variant: 'default', label: 'Reviewing' },
      info_required: { variant: 'destructive', label: 'Info Needed' },
      escalated: { variant: 'destructive', label: 'Escalated' },
      resolved: { variant: 'outline', label: 'Resolved' },
      closed: { variant: 'outline', label: 'Closed' },
    };
    const c = config[status] || { variant: 'secondary', label: status };
    return <Badge variant={c.variant} className="text-xs">{c.label}</Badge>;
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
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border safe-top">
          <div className="flex items-center h-14 px-4 gap-2">
            <button onClick={() => navigate('/merchant-disputes')} className="p-2 -ml-2 hover:bg-muted rounded-full">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <Skeleton className="h-5 w-28" />
          </div>
        </header>
        <div className="p-4 space-y-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-36 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!dispute || !order) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined text-3xl text-muted-foreground mb-2">error</span>
          <p className="text-muted-foreground mb-4">Dispute not found</p>
          <Button variant="outline" onClick={() => navigate('/merchant-disputes')}>
            Back to Disputes
          </Button>
        </div>
      </div>
    );
  }

  const canRespond = dispute.status === 'open' || dispute.status === 'info_required';

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />

      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border safe-top">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/merchant-disputes')} className="p-2 -ml-2 hover:bg-muted rounded-full touch-target">
              <span className="material-symbols-outlined text-xl">arrow_back</span>
            </button>
            <h1 className="text-base font-semibold text-foreground">Dispute Response</h1>
          </div>
          {getStatusBadge(dispute.status)}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-44">
        <div className="px-4 py-4 space-y-3">
          {/* Summary */}
          <div className="bg-muted/30 rounded-xl p-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Summary</h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-[11px] text-muted-foreground">Dispute ID</p>
                <p className="font-medium text-foreground">{dispute.id.slice(0, 8)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Order</p>
                <p className="font-medium text-foreground">#{order.order_number}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Customer</p>
                <p className="font-medium text-foreground">{customerName}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Amount</p>
                <p className="font-medium text-foreground">{formatAmount(order.amount)}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[11px] text-muted-foreground">Issue</p>
                <p className="font-medium text-foreground">{dispute.issue_type || dispute.reason}</p>
              </div>
              {dispute.description && (
                <div className="col-span-2">
                  <p className="text-[11px] text-muted-foreground">Description</p>
                  <p className="text-sm text-foreground">{dispute.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-muted/30 rounded-xl p-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Timeline</h2>
            <div className="space-y-3">
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-sm text-destructive">gavel</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Dispute Opened</p>
                  <p className="text-[10px] text-muted-foreground">{formatDate(dispute.created_at)}</p>
                </div>
              </div>

              {updates.map((update) => (
                <div key={update.id} className="flex gap-2.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                    update.actor_type === 'merchant' ? 'bg-primary/20' : 
                    update.actor_type === 'admin' ? 'bg-blue-500/20' : 'bg-muted'
                  }`}>
                    <span className={`material-symbols-outlined text-sm ${
                      update.actor_type === 'merchant' ? 'text-primary' : 
                      update.actor_type === 'admin' ? 'text-blue-500' : 'text-muted-foreground'
                    }`}>
                      {update.actor_type === 'merchant' ? 'storefront' : 
                       update.actor_type === 'admin' ? 'admin_panel_settings' : 'update'}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{update.title}</p>
                    {update.description && (
                      <p className="text-xs text-muted-foreground">{update.description}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(update.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Comments */}
          {comments.length > 0 && (
            <div className="bg-muted/30 rounded-xl p-3">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Responses</h2>
              <div className="space-y-2">
                {comments.map((comment) => (
                  <div key={comment.id} className={`p-2.5 rounded-lg ${
                    comment.is_admin ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-primary/10 border border-primary/20'
                  }`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`text-[10px] font-medium ${comment.is_admin ? 'text-blue-600' : 'text-primary'}`}>
                        {comment.is_admin ? 'Admin' : 'You'}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{formatDate(comment.created_at)}</span>
                    </div>
                    <p className="text-sm text-foreground">{comment.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Evidence Files */}
          {files.length > 0 && (
            <div className="bg-muted/30 rounded-xl p-3">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Evidence</h2>
              <div className="space-y-1.5">
                {files.map((file) => (
                  <a
                    key={file.id}
                    href={file.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 p-2.5 bg-background rounded-lg active:bg-muted"
                  >
                    <span className="material-symbols-outlined text-muted-foreground text-lg">
                      {file.file_type.startsWith('image/') ? 'image' : 'description'}
                    </span>
                    <p className="text-sm font-medium text-foreground truncate flex-1">{file.file_name}</p>
                    <span className="material-symbols-outlined text-muted-foreground text-sm">open_in_new</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Upload Evidence Button */}
          {canRespond && (
            <Link to={`/merchant-dispute-upload/${disputeId}`}>
              <Button variant="outline" className="w-full h-10">
                <span className="material-symbols-outlined text-sm mr-1.5">upload_file</span>
                Upload Evidence
              </Button>
            </Link>
          )}
        </div>
      </main>

      {/* Response Input */}
      {canRespond && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 safe-bottom">
          <div className="max-w-lg mx-auto space-y-2">
            <Textarea
              placeholder="Write your response..."
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              rows={2}
              className="resize-none"
            />
            <Button 
              onClick={handleSubmitResponse} 
              disabled={!responseText.trim() || isSubmitting}
              className="w-full h-10"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent mr-2" />
                  Submitting...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm mr-1.5">send</span>
                  Submit Response
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
