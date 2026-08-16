import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Gavel,
  Landmark,
  Lock,
  RotateCcw,
  ShoppingCart,
  Truck,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MerchantPageHeader } from '@/components/merchant/MerchantPageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge, type StatusTone } from '@/components/shared/StatusBadge';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { MerchantBottomNav } from '@/components/shared/MerchantBottomNav';
import { formatAmount } from '@/lib/format';
import { cn } from '@/lib/utils';

interface PaymentTx {
  id: string;
  public_payment_id: string | null;
  order_id: string;
  customer_id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  amount: number;
  currency: string | null;
  status: string;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
  session_id: string | null;
  gateway: string | null;
  method: string | null;
}

interface OrderRow {
  id: string;
  merchant_id: string;
  public_order_id: string | null;
  order_number: string;
  product_name: string;
  amount: number;
  currency: string | null;
  status: string;
  escrow_status: string | null;
  tracking_number: string | null;
  created_at: string;
  updated_at: string;
}

interface LinkedRefund {
  id: string;
  public_refund_id: string | null;
  amount: number;
  currency: string | null;
  status: string;
  reason: string | null;
  created_at: string;
}

interface LinkedDispute {
  id: string;
  public_dispute_id: string | null;
  status: string;
  created_at: string;
}

interface LinkedShipment {
  id: string;
  tracking_number: string | null;
  courier_partner: string | null;
  status: string | null;
  shipment_date: string | null;
}

interface LedgerRow {
  id: string;
  type: string;
  amount: number;
  currency: string | null;
  status: string;
  description: string | null;
  created_at: string;
}

interface TimelineEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  tone: StatusTone;
  done: boolean;
}

const TX_STATUS: Record<string, { tone: StatusTone; label: string }> = {
  success: { tone: 'success', label: 'Success' },
  succeeded: { tone: 'success', label: 'Succeeded' },
  captured: { tone: 'success', label: 'Captured' },
  completed: { tone: 'success', label: 'Completed' },
  processed: { tone: 'success', label: 'Processed' },
  pending: { tone: 'neutral', label: 'Pending' },
  failed: { tone: 'destructive', label: 'Failed' },
  processing: { tone: 'warning', label: 'Processing' },
};

const REFUND_STATUS: Record<string, { tone: StatusTone; label: string }> = {
  initiated: { tone: 'info', label: 'Initiated' },
  processing: { tone: 'warning', label: 'Processing' },
  success: { tone: 'success', label: 'Completed' },
  failed: { tone: 'destructive', label: 'Failed' },
};

const DISPUTE_STATUS: Record<string, { tone: StatusTone; label: string }> = {
  open: { tone: 'destructive', label: 'Pending' },
  under_review: { tone: 'info', label: 'Reviewing' },
  info_required: { tone: 'destructive', label: 'Info Needed' },
  escalated: { tone: 'destructive', label: 'Escalated' },
  resolved: { tone: 'neutral', label: 'Resolved' },
  closed: { tone: 'neutral', label: 'Closed' },
};

const SHIP_STATUS: Record<string, { tone: StatusTone; label: string }> = {
  pending: { tone: 'neutral', label: 'Pending' },
  in_transit: { tone: 'info', label: 'In Transit' },
  out_for_delivery: { tone: 'info', label: 'Out for delivery' },
  delivered: { tone: 'success', label: 'Delivered' },
  failed: { tone: 'destructive', label: 'Failed' },
};

function DetailRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className={cn('break-all text-right text-xs font-medium text-foreground', mono && 'font-mono')}>{value}</span>
    </div>
  );
}

function LinkRow({ label, value, to, icon: Icon }: { label: string; value: string; to: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 transition-all hover:border-primary/30 active:scale-[0.99]"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{value}</p>
        <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      </div>
    </Link>
  );
}

function TimelineIcon({ tone, done }: { tone: StatusTone; done: boolean }) {
  const cls =
    tone === 'success'
      ? 'bg-success/10 text-success'
      : tone === 'destructive'
        ? 'bg-destructive/10 text-destructive'
        : tone === 'warning'
          ? 'bg-warning/10 text-warning'
          : 'bg-primary/10 text-primary';
  return (
    <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', cls)}>
      {done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
    </div>
  );
}

export default function MerchantTransactionDetail() {
  const { transactionId } = useParams<{ transactionId: string }>();
  const navigate = useNavigate();
  const { merchant } = useMerchantAuth();

  const [tx, setTx] = useState<PaymentTx | null>(null);
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [refunds, setRefunds] = useState<LinkedRefund[]>([]);
  const [dispute, setDispute] = useState<LinkedDispute | null>(null);
  const [shipment, setShipment] = useState<LinkedShipment | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!transactionId || !merchant?.id) return;
    setIsLoading(true);
    try {
      const { data: txData, error: txError } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('id', transactionId)
        .single();
      if (txError) throw txError;
      setTx(txData as PaymentTx);

      const { data: orderData } = await supabase
        .from('orders')
        .select('id, merchant_id, public_order_id, order_number, product_name, amount, currency, status, escrow_status, tracking_number, created_at, updated_at')
        .eq('id', txData.order_id)
        .single();

      if (!orderData || orderData.merchant_id !== merchant.id) {
        toast.error('Access denied');
        navigate('/merchant-transactions');
        return;
      }
      setOrder(orderData as OrderRow);

      const [refundRes, disputeRes, shipRes, ledgerRes] = await Promise.all([
        supabase
          .from('refunds')
          .select('id, public_refund_id, amount, currency, status, reason, created_at')
          .eq('order_id', txData.order_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('disputes')
          .select('id, public_dispute_id, status, created_at')
          .eq('order_id', txData.order_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('order_tracking')
          .select('id, tracking_number, courier_partner, status, shipment_date')
          .eq('order_id', txData.order_id)
          .maybeSingle(),
        supabase
          .from('wallet_transactions')
          .select('id, type, amount, currency, status, description, created_at')
          .eq('reference_id', txData.order_id)
          .eq('reference_type', 'order')
          .order('created_at', { ascending: true }),
      ]);

      setRefunds((refundRes.data ?? []) as LinkedRefund[]);
      setDispute((disputeRes.data as LinkedDispute | null) ?? null);
      setShipment((shipRes.data as LinkedShipment | null) ?? null);
      setLedger((ledgerRes.data ?? []) as LedgerRow[]);
    } catch (error) {
      console.error('Transaction fetch error:', error);
      toast.error('Failed to load transaction');
      navigate('/merchant-transactions');
    } finally {
      setIsLoading(false);
    }
  }, [transactionId, merchant?.id, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!transactionId) return;
    const channel = supabase
      .channel(`merchant-tx-${transactionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_transactions', filter: `id=eq.${transactionId}` }, () => fetchData())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [transactionId, fetchData]);

  const timeline = useMemo<TimelineEvent[]>(() => {
    if (!tx || !order) return [];
    const events: TimelineEvent[] = [
      {
        id: 'initiated',
        title: 'Payment Initiated',
        description: `Payment of ${formatAmount(tx.amount, tx.currency)} initiated via ${tx.gateway ?? 'SafePay'}${tx.method ? ` (${tx.method})` : ''}`,
        date: tx.created_at,
        tone: 'info',
        done: true,
      },
      {
        id: 'confirmed',
        title: 'Payment Confirmed',
        description: tx.status === 'failed' ? tx.failure_reason ?? 'Payment failed' : 'Funds received and confirmed',
        date: tx.updated_at,
        tone: tx.status === 'failed' ? 'destructive' : tx.status === 'pending' || tx.status === 'processing' ? 'warning' : 'success',
        done: tx.status !== 'pending' && tx.status !== 'processing' && tx.status !== 'failed',
      },
      {
        id: 'escrow',
        title: 'Funds Held in SafePay',
        description: order.escrow_status === 'released' ? 'Funds protected in escrow until delivery' : order.escrow_status === 'held' ? 'Funds protected in escrow until delivery is confirmed' : 'Escrow protection applies to this order',
        date: order.created_at,
        tone: 'info',
        done: order.escrow_status === 'held' || order.escrow_status === 'released' || order.escrow_status === 'refunded',
      },
    ];

    if (order.status === 'completed' && order.escrow_status === 'released') {
      events.push({
        id: 'released',
        title: 'Payment Released',
        description: `Funds released to your wallet`,
        date: order.updated_at || order.created_at,
        tone: 'success',
        done: true,
      });
    }

    if (order.status === 'refunded' || order.status === 'cancelled') {
      events.push({
        id: 'refunded',
        title: 'Payment Refunded',
        description: `Refunded to the customer${refunds.length > 0 ? ` (${formatAmount(refunds[0].amount, refunds[0].currency)})` : ''}`,
        date: refunds[0]?.created_at ?? order.created_at,
        tone: 'neutral',
        done: true,
      });
    }

    if (order.status === 'disputed') {
      events.push({
        id: 'disputed',
        title: 'Dispute Raised',
        description: 'Payment is under dispute — release is on hold',
        date: dispute?.created_at ?? order.created_at,
        tone: 'destructive',
        done: true,
      });
    }

    return events;
  }, [tx, order, refunds, dispute]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-5 pb-16 sm:px-6 sm:py-7">
        <Skeleton className="mb-4 h-9 w-56 rounded-lg" />
        <Skeleton className="mb-4 h-32 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!tx || !order) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="mb-4 text-muted-foreground">Transaction not found</p>
        <Button variant="outline" onClick={() => navigate('/merchant-transactions')}>
          Back to Transactions
        </Button>
      </div>
    );
  }

  const txConfig = TX_STATUS[tx.status] ?? { tone: 'neutral' as StatusTone, label: tx.status };
  const successRefunds = refunds.filter((r) => r.status === 'success');
  const refundedAmount = successRefunds.reduce((s, r) => s + Number(r.amount), 0);
  const netAmount = Number(order.amount) - refundedAmount;

  return (
    <>
      <div className="mx-auto max-w-3xl px-4 py-5 pb-16 sm:px-6 sm:py-7">
        <MerchantPageHeader
          title={tx.public_payment_id ?? `Payment ${tx.id.slice(0, 8)}`}
          subtitle={new Date(tx.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
          back={{ fallback: '/merchant-transactions', label: 'Back to Transactions' }}
          actions={<StatusBadge tone={txConfig.tone} label={txConfig.label} dot />}
        />

        {/* Amount */}
        <Card className="mb-4 p-5">
          <p className="text-xs font-medium text-muted-foreground">Transaction Amount</p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-foreground">{formatAmount(tx.amount, tx.currency)}</p>
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Order</p>
              <p className="text-sm font-bold text-foreground tabular-nums">{formatAmount(order.amount, order.currency)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Refunded</p>
              <p className="text-sm font-bold text-destructive tabular-nums">{formatAmount(refundedAmount, tx.currency)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Net</p>
              <p className="text-sm font-bold text-success tabular-nums">{formatAmount(netAmount, tx.currency)}</p>
            </div>
          </div>
        </Card>

        {/* Details */}
        <Card className="mb-4 p-4">
          <h2 className="mb-2 text-sm font-semibold text-foreground">Details</h2>
          <div className="divide-y divide-border">
            <DetailRow label="Customer" value={tx.customer_name ?? tx.customer_email ?? 'Customer'} />
            {tx.customer_email && <DetailRow label="Email" value={tx.customer_email} mono />}
            {tx.customer_phone && <DetailRow label="Phone" value={tx.customer_phone} mono />}
            <DetailRow label="Payment method" value={tx.method ? tx.method.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '—'} />
            <DetailRow label="Gateway" value={tx.gateway ?? 'SafePay'} />
            {tx.razorpay_order_id && <DetailRow label="Gateway order ref" value={tx.razorpay_order_id} mono />}
            {tx.razorpay_payment_id && <DetailRow label="Gateway payment ref" value={tx.razorpay_payment_id} mono />}
            {tx.failure_reason && <DetailRow label="Failure reason" value={<span className="text-destructive">{tx.failure_reason}</span>} />}
            <DetailRow label="Escrow status" value={order.escrow_status ? order.escrow_status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '—'} />
            <DetailRow label="Updated" value={new Date(tx.updated_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} />
          </div>
        </Card>

        {/* Timeline */}
        <Card className="mb-4 p-4">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Timeline</h2>
          <div className="space-y-0">
            {timeline.map((event, index) => (
              <div key={event.id} className="relative flex gap-3 pb-4">
                {index < timeline.length - 1 && <div className="absolute left-[15px] top-8 bottom-0 w-0.5 bg-border" />}
                <TimelineIcon tone={event.tone} done={event.done} />
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-sm font-medium text-foreground">{event.title}</p>
                  <p className="text-xs text-muted-foreground">{event.description}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {new Date(event.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Ledger */}
        {ledger.length > 0 && (
          <Card className="mb-4 p-4">
            <h2 className="mb-3 text-sm font-semibold text-foreground">Ledger Activity</h2>
            <div className="space-y-2">
              {ledger.map((l) => (
                <div key={l.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 p-3">
                  <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', l.type === 'credit' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground')}>
                    <Landmark className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">{l.description ?? l.type}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(l.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                  <p className={cn('shrink-0 text-xs font-bold tabular-nums', l.type === 'credit' ? 'text-success' : 'text-foreground')}>
                    {l.type === 'credit' ? '+' : ''}{formatAmount(l.amount, l.currency)}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Linked records */}
        <div className="space-y-2">
          <LinkRow icon={ShoppingCart} label={`Order ${order.public_order_id ?? `#${order.order_number}`} · ${formatAmount(order.amount, order.currency)}`} value="View Order" to={`/merchant-order/${order.id}`} />
          {shipment ? (
            <LinkRow
              icon={Truck}
              label={`${shipment.tracking_number ?? 'No tracking yet'} · ${SHIP_STATUS[shipment.status ?? '']?.label ?? shipment.status}`}
              value="Shipment"
              to={`/merchant-shipments/${order.id}`}
            />
          ) : null}
          {refunds.length > 0 &&
            refunds.map((r) => {
              const c = REFUND_STATUS[r.status] ?? { tone: 'neutral' as StatusTone, label: r.status };
              return (
                <LinkRow
                  key={r.id}
                  icon={RotateCcw}
                  label={`${formatAmount(r.amount, r.currency)} · ${c.label}`}
                  value="Refund"
                  to={`/merchant-refunds/${r.id}`}
                />
              );
            })}
          {dispute && (
            <LinkRow
              icon={Gavel}
              label={`${DISPUTE_STATUS[dispute.status]?.label ?? dispute.status} · ${new Date(dispute.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
              value="Dispute"
              to={`/merchant-dispute-response/${dispute.id}`}
            />
          )}
        </div>

        {!shipment && !refunds.length && !dispute && (
          <EmptyState icon={Wallet} title="No linked records" description="This transaction has no shipments, refunds or disputes yet." className="mt-4" />
        )}
      </div>
      <MerchantBottomNav />
    </>
  );
}
