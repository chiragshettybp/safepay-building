import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type MerchantNavCounts = {
  orders: number;
  shipments: number;
  disputes: number;
  notifications: number;
};

const EMPTY_COUNTS: MerchantNavCounts = { orders: 0, shipments: 0, disputes: 0, notifications: 0 };

type MerchantNavContextValue = {
  counts: MerchantNavCounts;
  loading: boolean;
  refresh: () => Promise<void>;
};

const MerchantNavContext = createContext<MerchantNavContextValue>({
  counts: EMPTY_COUNTS,
  loading: true,
  refresh: async () => {},
});

export function MerchantNavProvider({ merchantId, userId, children }: { merchantId: string; userId: string | null; children: React.ReactNode }) {
  const [counts, setCounts] = useState<MerchantNavCounts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!merchantId) return;
    try {
      const [unreadRes, toShipRes, disputeIdsRes] = await Promise.all([
        userId
          ? supabase
              .from('notifications')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', userId)
              .eq('read', false)
          : Promise.resolve({ count: 0 }),
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('merchant_id', merchantId)
          .in('status', ['pending', 'awaiting_shipment']),
        supabase.from('orders').select('id').eq('merchant_id', merchantId).in('status', ['disputed']),
      ]);

      const unread = unreadRes.count ?? 0;
      const toShip = toShipRes.count ?? 0;

      const ids = (disputeIdsRes.data ?? []).map((r) => r.id);
      let disputeAttention = 0;
      if (ids.length > 0) {
        const { count } = await supabase
          .from('disputes')
          .select('id', { count: 'exact', head: true })
          .in('order_id', ids)
          .eq('merchant_not_responded', true);
        disputeAttention = count ?? 0;
      }

      setCounts({
        orders: toShip,
        shipments: toShip,
        disputes: disputeAttention,
        notifications: unread,
      });
    } catch (error) {
      console.error('MerchantNav counts error:', error);
    } finally {
      setLoading(false);
    }
  }, [merchantId, userId]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!merchantId) return;
    const channels = [
      supabase
        .channel('merchant-nav-orders')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `merchant_id=eq.${merchantId}` }, refresh)
        .subscribe(),
      supabase
        .channel('merchant-nav-disputes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'disputes' }, refresh)
        .subscribe(),
    ];
    if (userId) {
      channels.push(
        supabase
          .channel('merchant-nav-notifications')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, refresh)
          .subscribe()
      );
    }
    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [merchantId, userId, refresh]);

  return <MerchantNavContext.Provider value={{ counts, loading, refresh }}>{children}</MerchantNavContext.Provider>;
}

export function useMerchantNav() {
  return useContext(MerchantNavContext);
}
