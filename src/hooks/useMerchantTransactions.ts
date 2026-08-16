import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

export interface MerchantWalletRow {
  id: string;
  balance: number;
  pending_balance: number;
  total_earned: number;
  total_withdrawn: number;
  currency: string;
}

export function useMerchantTransactions(merchantId: string, enabled = true) {
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<MerchantTransactionRow[]>([]);
  const [wallet, setWallet] = useState<MerchantWalletRow | null>(null);

  const refresh = useCallback(async () => {
    if (!merchantId || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const { data: orderData, error: ordersError } = await supabase
        .from('orders')
        .select('id, public_order_id, order_number, product_name')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false })
        .limit(1000);
      if (ordersError) throw ordersError;
      const ordersList = orderData ?? [];
      const orderIds = ordersList.map((o) => o.id);
      const orderMap = new Map(ordersList.map((o) => [o.id, o]));

      const [paymentsRes, refundsRes, payoutsRes, walletRes] = await Promise.all([
        orderIds.length > 0
          ? supabase
              .from('payment_transactions')
              .select('id, order_id, amount, currency, status, created_at')
              .in('order_id', orderIds)
              .order('created_at', { ascending: false })
              .limit(100)
          : Promise.resolve({ data: [], error: null }),
        orderIds.length > 0
          ? supabase
              .from('refunds')
              .select('id, public_refund_id, order_id, amount, currency, status, reason, created_at')
              .in('order_id', orderIds)
              .order('created_at', { ascending: false })
              .limit(100)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from('merchant_payouts')
          .select('id, public_payout_id, amount, currency, status, created_at')
          .eq('merchant_id', merchantId)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase.from('merchant_wallets').select('*').eq('merchant_id', merchantId).maybeSingle(),
      ]);

      const merged: MerchantTransactionRow[] = [];
      (paymentsRes.data ?? []).forEach((p: any) => {
        const o = orderMap.get(p.order_id);
        merged.push({
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
        merged.push({
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
        merged.push({
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
      merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setTransactions(merged);
      setWallet((walletRes.data as MerchantWalletRow) ?? null);
    } catch (err) {
      console.error('Transactions fetch error:', err);
      setError('Something went wrong while loading your transactions.');
    } finally {
      setLoading(false);
    }
  }, [merchantId, enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!merchantId || !enabled) return;
    const tables = ['payment_transactions', 'refunds', 'merchant_payouts'] as const;
    const channels = tables.map((table) =>
      supabase
        .channel(`merchant-txn-${table}-${merchantId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, refresh)
        .subscribe(),
    );
    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [merchantId, enabled, refresh]);

  return { loading, error, transactions, wallet, refresh };
}
