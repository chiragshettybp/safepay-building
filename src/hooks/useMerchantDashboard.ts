import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MerchantWalletRow {
  id: string;
  balance: number;
  pending_balance: number;
  total_earned: number;
  total_withdrawn: number;
  currency: string;
}

export interface MerchantOrderRow {
  id: string;
  public_order_id: string | null;
  order_number: string;
  product_name: string;
  amount: number;
  currency: string | null;
  status: string;
  escrow_status: string | null;
  created_at: string;
  expected_delivery: string | null;
  customer_id: string | null;
  tracking_number: string | null;
  carrier: string | null;
  shipped_at: string | null;
  item_count: number | null;
}

export interface MerchantDisputeRow {
  id: string;
  public_dispute_id: string | null;
  order_id: string;
  status: string;
  merchant_not_responded: boolean | null;
  reason: string;
  created_at: string;
  updated_at: string;
}

export interface MerchantTransactionRow {
  id: string;
  type: 'payment' | 'refund' | 'payout';
  amount: number;
  currency: string | null;
  status: string;
  label: string;
  reference: string;
  created_at: string;
}

export interface MerchantActivityRow {
  id: string;
  activity_type: string;
  title: string;
  description: string | null;
  created_at: string;
}

export interface DashboardStats {
  totalOrders: number;
  pending: number;
  awaitingShipment: number;
  inTransit: number;
  delivered: number;
  completed: number;
  disputed: number;
  refunded: number;
  cancelled: number;
  toShip: number;
  heldFunds: number;
  revenue7d: number;
  revenue30d: number;
}

export interface OrderPipelineStage {
  key: string;
  label: string;
  count: number;
}

export interface RevenuePoint {
  date: string;
  amount: number;
}

export function orderPipeline(orders: MerchantOrderRow[]): OrderPipelineStage[] {
  const stage = (status: string) => {
    if (status === 'pending' || status === 'awaiting_shipment') return 'Pending';
    if (status === 'shipped' || status === 'in_progress') return 'In Transit';
    if (status === 'delivered') return 'Delivered';
    if (status === 'completed') return 'Completed';
    return null;
  };
  const map: Record<string, number> = { Pending: 0, 'In Transit': 0, Delivered: 0, Completed: 0 };
  orders.forEach((o) => {
    const s = stage(o.status);
    if (s && map[s] !== undefined) map[s] += 1;
  });
  return [
    { key: 'pending', label: 'Pending', count: map.Pending },
    { key: 'in_transit', label: 'In Transit', count: map['In Transit'] },
    { key: 'delivered', label: 'Delivered', count: map.Delivered },
    { key: 'completed', label: 'Completed', count: map.Completed },
  ];
}

export function revenueSeries(orders: MerchantOrderRow[], days: number): RevenuePoint[] {
  const now = new Date();
  const bucket = new Map<string, number>();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    bucket.set(d.toISOString().slice(0, 10), 0);
  }
  orders.forEach((o) => {
    if (o.escrow_status !== 'released') return;
    const day = new Date(o.created_at).toISOString().slice(0, 10);
    if (bucket.has(day)) bucket.set(day, (bucket.get(day) ?? 0) + Number(o.amount));
  });
  return [...bucket.entries()].map(([date, amount]) => ({ date, amount }));
}

export function useMerchantDashboard(merchantId: string) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wallet, setWallet] = useState<MerchantWalletRow | null>(null);
  const [orders, setOrders] = useState<MerchantOrderRow[]>([]);
  const [disputes, setDisputes] = useState<MerchantDisputeRow[]>([]);
  const [transactions, setTransactions] = useState<MerchantTransactionRow[]>([]);
  const [activities, setActivities] = useState<MerchantActivityRow[]>([]);

  const refresh = useCallback(async () => {
    if (!merchantId) return;
    setLoading(true);
    setError(null);
    try {
      const [{ data: walletRow }, { data: orderRows, error: ordersError }] = await Promise.all([
        supabase.from('merchant_wallets').select('*').eq('merchant_id', merchantId).maybeSingle(),
        supabase
          .from('orders')
          .select('id, public_order_id, order_number, product_name, amount, currency, status, escrow_status, created_at, expected_delivery, customer_id, tracking_number, carrier, shipped_at, item_count')
          .eq('merchant_id', merchantId)
          .order('created_at', { ascending: false })
          .limit(500),
      ]);

      if (ordersError) {
        console.error('Orders fetch error:', ordersError);
        setError('Unable to load orders right now.');
      }

      const orderList: MerchantOrderRow[] = (orderRows ?? []) as MerchantOrderRow[];
      setWallet((walletRow as MerchantWalletRow) ?? null);
      setOrders(orderList);

      const disputedIds = orderList.filter((o) => o.status === 'disputed').map((o) => o.id);
      if (disputedIds.length > 0) {
        const { data: disputeRows } = await supabase
          .from('disputes')
          .select('id, public_dispute_id, order_id, status, merchant_not_responded, reason, created_at, updated_at')
          .in('order_id', disputedIds)
          .order('created_at', { ascending: false });
        setDisputes((disputeRows ?? []) as MerchantDisputeRow[]);
      } else {
        setDisputes([]);
      }

      const orderIds = orderList.map((o) => o.id);
      const orderMap = new Map(orderList.map((o) => [o.id, o]));
      const [paymentsRes, refundsRes, payoutsRes, activityRes] = await Promise.all([
        orderIds.length > 0
          ? supabase
              .from('payment_transactions')
              .select('id, order_id, amount, currency, status, created_at')
              .in('order_id', orderIds)
              .order('created_at', { ascending: false })
              .limit(20)
          : Promise.resolve({ data: [], error: null }),
        orderIds.length > 0
          ? supabase
              .from('refunds')
              .select('id, order_id, amount, currency, status, reason, created_at')
              .in('order_id', orderIds)
              .order('created_at', { ascending: false })
              .limit(20)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from('merchant_payouts')
          .select('id, public_payout_id, amount, currency, status, created_at')
          .eq('merchant_id', merchantId)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('merchant_activity')
          .select('*')
          .eq('merchant_id', merchantId)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      const txns: MerchantTransactionRow[] = [];
      (paymentsRes.data ?? []).forEach((p: any) => {
        const o = orderMap.get(p.order_id);
        txns.push({
          id: p.id,
          type: 'payment',
          amount: Number(p.amount),
          currency: p.currency,
          status: p.status,
          label: `Payment received · ${o?.product_name ?? 'Order'}`,
          reference: o?.public_order_id ?? o?.order_number ?? 'Order',
          created_at: p.created_at,
        });
      });
      (refundsRes.data ?? []).forEach((r: any) => {
        const o = orderMap.get(r.order_id);
        txns.push({
          id: r.id,
          type: 'refund',
          amount: -Number(r.amount),
          currency: r.currency,
          status: r.status,
          label: `Refund · ${r.reason ?? 'Order refund'}`,
          reference: o?.public_order_id ?? o?.order_number ?? 'Refund',
          created_at: r.created_at,
        });
      });
      (payoutsRes.data ?? []).forEach((p: any) => {
        txns.push({
          id: p.id,
          type: 'payout',
          amount: -Number(p.amount),
          currency: p.currency,
          status: p.status,
          label: 'Payout to bank',
          reference: p.public_payout_id ?? 'Payout',
          created_at: p.created_at,
        });
      });
      txns.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setTransactions(txns.slice(0, 12));

      setActivities((activityRes.data ?? []) as MerchantActivityRow[]);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError('Something went wrong while loading your dashboard.');
    } finally {
      setLoading(false);
    }
  }, [merchantId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const stats: DashboardStats = {
    totalOrders: orders.length,
    pending: orders.filter((o) => o.status === 'pending').length,
    awaitingShipment: orders.filter((o) => o.status === 'awaiting_shipment').length,
    inTransit: orders.filter((o) => o.status === 'shipped' || o.status === 'in_progress').length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
    completed: orders.filter((o) => o.status === 'completed').length,
    disputed: orders.filter((o) => o.status === 'disputed').length,
    refunded: orders.filter((o) => o.status === 'refunded').length,
    cancelled: orders.filter((o) => o.status === 'cancelled').length,
    toShip: orders.filter((o) => o.status === 'pending' || o.status === 'awaiting_shipment').length,
    heldFunds: orders.reduce((sum, o) => (o.escrow_status === 'held' ? sum + Number(o.amount) : sum), 0),
    revenue7d: orders.reduce((sum, o) => {
      const t = new Date(o.created_at).getTime();
      if (o.escrow_status === 'released' && t >= Date.now() - 7 * 864e5) return sum + Number(o.amount);
      return sum;
    }, 0),
    revenue30d: orders.reduce((sum, o) => {
      const t = new Date(o.created_at).getTime();
      if (o.escrow_status === 'released' && t >= Date.now() - 30 * 864e5) return sum + Number(o.amount);
      return sum;
    }, 0),
  };

  const pipeline = orderPipeline(orders);
  const revenue = revenueSeries(orders, 30);

  return { loading, error, wallet, orders, disputes, transactions, activities, stats, pipeline, revenue, refresh };
}
