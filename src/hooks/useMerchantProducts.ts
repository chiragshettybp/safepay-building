import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type ProductStatus = 'active' | 'inactive' | 'out_of_stock';

export interface MerchantProductRow {
  id: string;
  merchant_id: string;
  name: string;
  description: string | null;
  price: number;
  sku: string | null;
  stock_quantity: number;
  status: ProductStatus;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductInput {
  name: string;
  description?: string | null;
  price: number;
  sku?: string | null;
  stock_quantity: number;
  status: ProductStatus;
  image_url?: string | null;
}

export function useMerchantProducts(merchantId: string, enabled = true) {
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<MerchantProductRow[]>([]);

  const refresh = useCallback(async () => {
    if (!merchantId || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false });
      if (fetchError) {
        setError('Unable to load products right now.');
        console.error('Products fetch error:', fetchError);
        return;
      }
      setProducts((data ?? []) as MerchantProductRow[]);
    } catch (err) {
      console.error('Products fetch error:', err);
      setError('Something went wrong while loading your products.');
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
      .channel(`merchant-products-${merchantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter: `merchant_id=eq.${merchantId}` }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [merchantId, enabled, refresh]);

  const createProduct = useCallback(
    async (input: ProductInput): Promise<MerchantProductRow | null> => {
      if (!merchantId) return null;
      const { data, error } = await supabase
        .from('products')
        .insert({ merchant_id: merchantId, ...input })
        .select()
        .single();
      if (error) {
        console.error('Product create error:', error);
        return null;
      }
      return data as MerchantProductRow;
    },
    [merchantId],
  );

  const updateProduct = useCallback(
    async (id: string, patch: Partial<ProductInput>): Promise<boolean> => {
      const { error } = await supabase
        .from('products')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('merchant_id', merchantId);
      if (error) {
        console.error('Product update error:', error);
        return false;
      }
      return true;
    },
    [merchantId],
  );

  const deleteProduct = useCallback(
    async (id: string): Promise<boolean> => {
      const { error } = await supabase.from('products').delete().eq('id', id).eq('merchant_id', merchantId);
      if (error) {
        console.error('Product delete error:', error);
        return false;
      }
      return true;
    },
    [merchantId],
  );

  return { loading, error, products, refresh, createProduct, updateProduct, deleteProduct };
}
