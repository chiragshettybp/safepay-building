import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
  delivered_at: string | null;
  item_count: number | null;
}

export function useMerchantOrders(merchantId: string, enabled = true) {
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<MerchantOrderRow[]>([]);

  const refresh = useCallback(async () => {
    if (!merchantId || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select(
          'id, public_order_id, order_number, product_name, amount, currency, status, escrow_status, created_at, expected_delivery, customer_id, tracking_number, carrier, shipped_at, delivered_at, item_count',
        )
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false })
        .limit(1000);
      if (fetchError) {
        setError('Unable to load orders right now.');
        console.error('Orders fetch error:', fetchError);
        return;
      }
      setOrders((data ?? []) as MerchantOrderRow[]);
    } catch (err) {
      console.error('Orders fetch error:', err);
      setError('Something went wrong while loading your orders.');
    } finally {
      setLoading(false);
    }
  }, [merchantId, enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!merchantId || !enabled) return;
    const channel = supabase
      .channel(`merchant-orders-${merchantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `merchant_id=eq.${merchantId}` }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [merchantId, enabled, refresh]);

  return { loading, error, orders, refresh };
}
