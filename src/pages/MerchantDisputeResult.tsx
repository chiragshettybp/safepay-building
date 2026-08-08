import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface Dispute {
  id: string;
  public_dispute_id: string;
  order_id: string;
  reason: string;
  description: string | null;
  issue_type: string | null;
  status: string;
  resolution: string | null;
  admin_notes: string | null;
  refund_amount: number | null;
  resolved_at: string | null;
  created_at: string;
}

interface Order {
  id: string;
  public_order_id: string;
  order_number: string;
  product_name: string;
  amount: number;
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

export default function MerchantDisputeResult() {
  const navigate = useNavigate();
  const { disputeId } = useParams<{ disputeId: string }>();
  const { merchant, isAuthenticated, isLoading: authLoading } = useMerchantAuth();
  
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [updates, setUpdates] = useState<DisputeUpdate[]>([]);
  const [files, setFiles] = useState<DisputeFile[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/merchant-login', { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  const fetchData = useCallback(async () => {
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
        .select('id, public_order_id, order_number, product_name, amount, merchant_id')
        .eq('id', disputeData.order_id)
        .single();

      if (orderError) throw orderError;

      if ((orderData as any)?.merchant_id !== merchant.id) {
        toast.error('Access denied');
        navigate('/merchant-disputes');
        return;
      }

      setOrder(orderData);

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
        .eq('dispute_id', disputeId);

      setFiles(filesData || []);

    } catch (error) {
      console.error('Error fetching dispute:', error);
      toast.error('Failed to load result');
    } finally {
      setIsLoading(false);
    }
  }, [disputeId, merchant?.id, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!disputeId) return;

    const channel = supabase
      .channel(`dispute-result-${disputeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'disputes', filter: `id=eq.${disputeId}` }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [disputeId, fetchData]);

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

  const getResolutionConfig = (resolution: string | null) => {
    switch (resolution) {
      case 'merchant_favor':
        return {
          icon: 'check_circle',
          title: 'Resolved in Your Favor',
          subtitle: 'Funds will be released to you.',
          color: 'text-green-600',
          bgColor: 'bg-green-500/10',
          borderColor: 'border-green-500/20',
        };
      case 'customer_favor':
        return {
          icon: 'cancel',
          title: 'Customer Won',
          subtitle: 'Refund issued to customer.',
          color: 'text-destructive',
          bgColor: 'bg-destructive/10',
          borderColor: 'border-destructive/20',
        };
      case 'partial_refund':
        return {
          icon: 'price_change',
          title: 'Partial Refund',
          subtitle: 'A partial refund was issued.',
          color: 'text-amber-600',
          bgColor: 'bg-amber-500/10',
          borderColor: 'border-amber-500/20',
        };
      default:
        return {
          icon: 'pending',
          title: 'Pending Resolution',
          subtitle: 'Still under review.',
          color: 'text-muted-foreground',
          bgColor: 'bg-muted/30',
          borderColor: 'border-border',
        };
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
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border safe-top">
          <div className="flex items-center h-14 px-4 gap-2">
            <button onClick={() => navigate('/merchant-disputes')} className="p-2 -ml-2 hover:bg-muted rounded-full">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <Skeleton className="h-5 w-28" />
          </div>
        </header>
        <div className="p-4 space-y-4">
          <Skeleton className="h-36 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-36 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!dispute || !order) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined text-3xl text-muted-foreground mb-2">error</span>
          <p className="text-muted-foreground mb-4">Not found</p>
          <Button variant="outline" onClick={() => navigate('/merchant-disputes')}>
            Back to Disputes
          </Button>
        </div>
      </div>
    );
  }

  const resolutionConfig = getResolutionConfig(dispute.resolution);

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />

      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border safe-top">
        <div className="flex items-center h-14 px-4">
          <button onClick={() => navigate('/merchant-disputes')} className="p-2 -ml-2 hover:bg-muted rounded-full touch-target">
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <h1 className="text-lg font-semibold text-foreground ml-2">Dispute Result</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        <div className="px-4 py-4 space-y-3">
          {/* Resolution Banner */}
          <div className={`rounded-xl p-5 border ${resolutionConfig.bgColor} ${resolutionConfig.borderColor}`}>
            <div className="flex flex-col items-center text-center">
              <div className={`w-14 h-14 rounded-full ${resolutionConfig.bgColor} flex items-center justify-center mb-3`}>
                <span className={`material-symbols-outlined text-3xl ${resolutionConfig.color}`}>
                  {resolutionConfig.icon}
                </span>
              </div>
              <h2 className={`text-lg font-bold ${resolutionConfig.color}`}>
                {resolutionConfig.title}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {resolutionConfig.subtitle}
              </p>
              {dispute.refund_amount && dispute.refund_amount > 0 && (
                <div className="mt-3 px-3 py-1.5 bg-background rounded-lg">
                  <p className="text-[10px] text-muted-foreground">Refund</p>
                  <p className={`text-base font-bold ${resolutionConfig.color}`}>
                    {formatAmount(dispute.refund_amount)}
                  </p>
                </div>
              )}
              {dispute.resolved_at && (
                <p className="text-xs text-muted-foreground mt-3">
                  {formatDate(dispute.resolved_at)}
                </p>
              )}
            </div>
          </div>

          {/* Admin Notes */}
          {dispute.admin_notes && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="material-symbols-outlined text-blue-600 text-lg">admin_panel_settings</span>
                <p className="text-sm font-medium text-blue-600">Admin Notes</p>
              </div>
              <p className="text-sm text-foreground">{dispute.admin_notes}</p>
            </div>
          )}

          {/* Order Details */}
          <div className="bg-muted/30 rounded-xl p-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Order</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-[11px] text-muted-foreground">Order #</p>
                <p className="font-medium text-foreground">{order.public_order_id || `#${order.order_number}`}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Amount</p>
                <p className="font-medium text-foreground">{formatAmount(order.amount)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Product</p>
                <p className="font-medium text-foreground truncate">{order.product_name}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Customer</p>
                <p className="font-medium text-foreground">{customerName}</p>
              </div>
            </div>
          </div>

          {/* Dispute Details */}
          <div className="bg-muted/30 rounded-xl p-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Dispute</h3>
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-[11px] text-muted-foreground">Issue</p>
                <p className="font-medium text-foreground">{dispute.issue_type || dispute.reason}</p>
              </div>
              {dispute.description && (
                <div>
                  <p className="text-[11px] text-muted-foreground">Description</p>
                  <p className="text-foreground">{dispute.description}</p>
                </div>
              )}
              <div>
                <p className="text-[11px] text-muted-foreground">Filed</p>
                <p className="font-medium text-foreground">{formatDate(dispute.created_at)}</p>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-muted/30 rounded-xl p-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Timeline</h3>
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
                    update.actor_type === 'admin' ? 'bg-blue-500/20' : 
                    update.actor_type === 'customer' ? 'bg-amber-500/20' : 'bg-muted'
                  }`}>
                    <span className={`material-symbols-outlined text-sm ${
                      update.actor_type === 'merchant' ? 'text-primary' : 
                      update.actor_type === 'admin' ? 'text-blue-500' : 
                      update.actor_type === 'customer' ? 'text-amber-500' : 'text-muted-foreground'
                    }`}>
                      {update.actor_type === 'merchant' ? 'storefront' : 
                       update.actor_type === 'admin' ? 'admin_panel_settings' : 
                       update.actor_type === 'customer' ? 'person' : 'update'}
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

              {dispute.resolved_at && (
                <div className="flex gap-2.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${resolutionConfig.bgColor}`}>
                    <span className={`material-symbols-outlined text-sm ${resolutionConfig.color}`}>
                      {resolutionConfig.icon}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{resolutionConfig.title}</p>
                    <p className="text-[10px] text-muted-foreground">{formatDate(dispute.resolved_at)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Evidence Files */}
          {files.length > 0 && (
            <div className="bg-muted/30 rounded-xl p-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Evidence</h3>
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

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Link to="/merchant-disputes" className="flex-1">
              <Button variant="outline" className="w-full h-10">
                Back to Disputes
              </Button>
            </Link>
            <Link to={`/merchant-order/${order.id}`} className="flex-1">
              <Button variant="secondary" className="w-full h-10">
                View Order
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-20 safe-bottom">
        <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
          <Link to="/merchant-dashboard" className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 text-muted-foreground touch-target">
            <span className="material-symbols-outlined text-xl">dashboard</span>
            <span className="text-[10px]">Home</span>
          </Link>
          <Link to="/merchant-orders" className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 text-muted-foreground touch-target">
            <span className="material-symbols-outlined text-xl">orders</span>
            <span className="text-[10px]">Orders</span>
          </Link>
          <Link to="/merchant-disputes" className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 text-primary touch-target">
            <span className="material-symbols-outlined text-xl">gavel</span>
            <span className="text-[10px] font-medium">Disputes</span>
          </Link>
          <Link to="/merchant-payouts" className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 text-muted-foreground touch-target">
            <span className="material-symbols-outlined text-xl">account_balance_wallet</span>
            <span className="text-[10px]">Payouts</span>
          </Link>
          <Link to="/merchant-profile" className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 text-muted-foreground touch-target">
            <span className="material-symbols-outlined text-xl">person</span>
            <span className="text-[10px]">Profile</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
