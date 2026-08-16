import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  AlertCircle,
  ChevronRight,
  ExternalLink,
  FileText,
  Gavel,
  Image,
  Info,
  Package,
  RefreshCw,
  ShieldCheck,
  Store,
  Truck,
  Undo2,
  UploadCloud,
} from 'lucide-react';
import { StatusBadge, type StatusTone } from '@/components/shared/StatusBadge';
import { FullPageLoading } from '@/components/shared/LoadingSpinner';
import DisputeChat from '@/components/shared/DisputeChat';
import { MerchantPageHeader } from '@/components/merchant/MerchantPageHeader';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface Dispute {
  id: string;
  public_dispute_id: string;
  order_id: string;
  customer_id: string;
  reason: string;
  description: string | null;
  issue_type: string | null;
  status: string;
  resolution: string | null;
  admin_notes: string | null;
  merchant_not_responded: boolean | null;
  created_at: string;
  updated_at: string;
}

interface Order {
  id: string;
  merchant_id: string;
  public_order_id: string;
  order_number: string;
  product_name: string;
  amount: number;
  currency: string | null;
  status: string;
  escrow_status: string | null;
  tracking_number: string | null;
  tracking_carrier: string | null;
  created_at: string;
}

interface DisputeUpdate {
  id: string;
  title: string;
  description: string | null;
  actor_type: string;
  created_at: string;
}

interface DisputeFile {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
}

interface DisputeRefund {
  id: string;
  public_refund_id: string | null;
  amount: number;
  status: string;
}

const MERCHANT_QUICK_REPLIES = [
  'We shipped this. Tracking is available.',
  'Please check the evidence we uploaded.',
  "We'd like to resolve this amicably.",
  'Can you share more details?',
];

const ACTIVE_CHAT_STATUSES = ['open', 'info_required', 'under_review', 'escalated', 'awaiting_response'];

export default function MerchantDisputeResponse() {
  const navigate = useNavigate();
  const { disputeId } = useParams<{ disputeId: string }>();
  const { merchant, isAuthenticated, isLoading: authLoading } = useMerchantAuth();

  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [updates, setUpdates] = useState<DisputeUpdate[]>([]);
  const [files, setFiles] = useState<DisputeFile[]>([]);
  const [refund, setRefund] = useState<DisputeRefund | null>(null);
  const [customerName, setCustomerName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);

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
        .select('*')
        .eq('id', disputeData.order_id)
        .returns<Order[]>()
        .single();

      if (orderError) throw orderError;
      setOrder(orderData);

      if (orderData.merchant_id !== merchant.id) {
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

      const { data: filesData } = await supabase
        .from('dispute_files')
        .select('*')
        .eq('dispute_id', disputeId)
        .order('created_at', { ascending: true });

      setFiles(filesData || []);

      const { data: refundData } = await supabase
        .from('refunds')
        .select('id, public_refund_id, amount, status')
        .eq('dispute_id', disputeId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setRefund((refundData as DisputeRefund | null) || null);
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dispute_files', filter: `dispute_id=eq.${disputeId}` }, () => fetchDisputeData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'refunds', filter: `dispute_id=eq.${disputeId}` }, () => fetchDisputeData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [disputeId, fetchDisputeData]);

  const handleMerchantMessageSent = useCallback(async () => {
    if (!disputeId || !merchant) return;

    try {
      const { error } = await supabase
        .from('disputes')
        .update({
          merchant_not_responded: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', disputeId);

      if (error) throw error;

      setDispute((prev) => (prev ? { ...prev, merchant_not_responded: false } : prev));

      const current = dispute;
      if (current && (current.status === 'open' || current.status === 'info_required')) {
        await supabase
          .from('disputes')
          .update({ status: 'under_review' })
          .eq('id', disputeId);

        await supabase.from('dispute_updates').insert({
          dispute_id: disputeId,
          title: 'Merchant Response',
          description: 'Merchant replied to the dispute conversation',
          update_type: 'response',
          actor_type: 'merchant',
        });

        setDispute((prev) => (prev ? { ...prev, status: 'under_review' } : prev));
      }
    } catch (error) {
      console.error('Error updating dispute after message:', error);
    }
  }, [disputeId, merchant, dispute]);

  const getStatusBadge = (status: string) => {
    const config: Record<string, { tone: StatusTone; label: string }> = {
      open: { tone: 'destructive', label: 'Pending' },
      under_review: { tone: 'info', label: 'Reviewing' },
      info_required: { tone: 'destructive', label: 'Info Needed' },
      escalated: { tone: 'destructive', label: 'Escalated' },
      resolved: { tone: 'neutral', label: 'Resolved' },
      closed: { tone: 'neutral', label: 'Closed' },
    };
    const c = config[status] || { tone: 'neutral', label: status };
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

  const formatAmount = (amount: number, currency?: string | null) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (authLoading || !isAuthenticated || !merchant) {
    return <FullPageLoading />;
  }

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <div className="px-4 py-5 sm:px-6">
          <MerchantPageHeader
            title={<Skeleton className="h-6 w-28" />}
            back={{ fallback: '/merchant-disputes', label: 'Back to Disputes' }}
          />
        </div>
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
          <AlertCircle className="h-7 w-7 text-muted-foreground mb-2 mx-auto" />
          <p className="text-muted-foreground mb-4">Dispute not found</p>
          <Button variant="outline" onClick={() => navigate('/merchant-disputes')}>
            Back to Disputes
          </Button>
        </div>
      </div>
    );
  }

  const canChat = ACTIVE_CHAT_STATUSES.includes(dispute.status);

  const detailsContent = (
    <div className="space-y-3">
      {/* Summary */}
      <div className="bg-muted/30 rounded-xl p-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Summary</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-[11px] text-muted-foreground">Dispute ID</p>
            <p className="font-medium text-foreground">{dispute.public_dispute_id || `#${dispute.id.slice(0, 8)}`}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Order</p>
            <p className="font-medium text-foreground">{order.public_order_id || `#${order.order_number}`}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Customer</p>
            <p className="font-medium text-foreground">{customerName}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Amount</p>
            <p className="font-medium text-foreground">{formatAmount(order.amount, order.currency)}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Status</p>
            <div className="mt-1">{getStatusBadge(dispute.status)}</div>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Opened</p>
            <p className="font-medium text-foreground">
              {new Date(dispute.created_at).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          </div>
          <div className="col-span-2">
            <p className="text-[11px] text-muted-foreground">Issue</p>
            <p className="font-medium text-foreground capitalize">{dispute.issue_type || dispute.reason}</p>
          </div>
          {dispute.description && (
            <div className="col-span-2">
              <p className="text-[11px] text-muted-foreground">Description</p>
              <p className="text-sm text-foreground">{dispute.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* Linked records */}
      <div className="bg-muted/30 rounded-xl p-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Linked Records</h2>
        <div className="space-y-1.5">
          <Link
            to={`/merchant-order/${order.id}`}
            className="flex items-center gap-2.5 p-2.5 bg-background rounded-lg active:bg-muted"
          >
            <Package className="h-[18px] w-[18px] text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{order.product_name}</p>
              <p className="text-[11px] text-muted-foreground">
                Order {order.public_order_id || `#${order.order_number}`}
              </p>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </Link>

          {order.tracking_number ? (
            <Link
              to={`/merchant-order/${order.id}`}
              className="flex items-center gap-2.5 p-2.5 bg-background rounded-lg active:bg-muted"
            >
              <Truck className="h-[18px] w-[18px] text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">Shipment</p>
                <p className="text-[11px] text-muted-foreground font-mono truncate">{order.tracking_number}</p>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </Link>
          ) : (
            <Link
              to={`/merchant-add-tracking/${order.id}`}
              className="flex items-center gap-2.5 p-2.5 bg-background rounded-lg active:bg-muted"
            >
              <Truck className="h-[18px] w-[18px] text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Add tracking</p>
                <p className="text-[11px] text-muted-foreground">No tracking uploaded yet</p>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </Link>
          )}

          {refund ? (
            <Link
              to={`/merchant-refunds/${refund.id}`}
              className="flex items-center gap-2.5 p-2.5 bg-background rounded-lg active:bg-muted"
            >
              <Undo2 className="h-[18px] w-[18px] text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground capitalize">
                  Refund {refund.status}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {formatAmount(refund.amount)} • {refund.public_refund_id || `#${refund.id.slice(0, 8)}`}
                </p>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </Link>
          ) : (
            <Link
              to="/merchant-transactions"
              className="flex items-center gap-2.5 p-2.5 bg-background rounded-lg active:bg-muted"
            >
              <Store className="h-[18px] w-[18px] text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Transactions</p>
                <p className="text-[11px] text-muted-foreground">View payment history</p>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </Link>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-muted/30 rounded-xl p-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Timeline</h2>
        <div className="space-y-3">
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0">
              <Gavel className="h-3.5 w-3.5 text-destructive" />
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
                {update.actor_type === 'merchant' ? (
                  <Store className="h-3.5 w-3.5 text-primary" />
                ) : update.actor_type === 'admin' ? (
                  <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                )}
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
                {file.file_type.startsWith('image/') ? (
                  <Image className="h-[18px] w-[18px] text-muted-foreground" />
                ) : (
                  <FileText className="h-[18px] w-[18px] text-muted-foreground" />
                )}
                <p className="text-sm font-medium text-foreground truncate flex-1">{file.file_name}</p>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Upload Evidence Button */}
      {canChat && (
        <Link to={`/merchant-dispute-upload/${disputeId}`}>
          <Button variant="outline" className="w-full h-10">
            <UploadCloud className="h-3.5 w-3.5 mr-1.5" />
            Upload Evidence
          </Button>
        </Link>
      )}
    </div>
  );

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="shrink-0 border-b border-border/60 bg-background">
        <div className="px-4 pt-5 pb-3 sm:px-6">
          <MerchantPageHeader
          title="Dispute Chat"
          subtitle={`${dispute.public_dispute_id || `#${dispute.id.slice(0, 8)}`} • ${customerName}`}
          back={{ fallback: '/merchant-disputes', label: 'Back to Disputes' }}
          actions={
            <div className="flex items-center gap-1.5">
            <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
              <SheetTrigger asChild>
                <button className="p-2 hover:bg-muted rounded-full touch-target lg:hidden" title="Dispute details">
                  <Info className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[85dvh] rounded-t-2xl overflow-y-auto pb-8">
                <SheetHeader>
                  <SheetTitle>Dispute Details</SheetTitle>
                </SheetHeader>
                <div className="pt-4">{detailsContent}</div>
              </SheetContent>
            </Sheet>
            {getStatusBadge(dispute.status)}
            </div>
          }
        />
        </div>

        {/* Compact dispute context card (mobile) */}
        <div className="px-4 pb-3 lg:hidden">
          <button
            onClick={() => setDetailsOpen(true)}
            className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left active:bg-muted"
            aria-label="View dispute details"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-foreground">{order.product_name}</p>
                {getStatusBadge(dispute.status)}
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {order.public_order_id || `#${order.order_number}`} •{' '}
                {formatAmount(order.amount, order.currency)} • {customerName}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 min-h-0 lg:grid lg:grid-cols-[400px_1fr] lg:overflow-hidden">
        {/* Details column (desktop) */}
        <aside className="hidden lg:block overflow-y-auto border-r border-border bg-muted/10 p-4">
          {detailsContent}
        </aside>

        {/* Chat column */}
        <section className="flex min-h-0 flex-col">
          <DisputeChat
            disputeId={dispute.id}
            orderId={dispute.order_id}
            senderType="merchant"
            senderId={merchant.id}
            senderName={merchant.businessName || 'Merchant'}
            canSend={canChat}
            quickReplies={MERCHANT_QUICK_REPLIES}
            onMessageSent={handleMerchantMessageSent}
            className="flex-1"
          />
        </section>
      </main>
    </div>
  );
}
