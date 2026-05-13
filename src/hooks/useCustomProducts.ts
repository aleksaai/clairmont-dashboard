import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CustomStatus {
  id: string;
  custom_product_id: string;
  name: string;
  label: string;
  order_index: number;
}

export interface CustomProduct {
  id: string;
  name: string;
  label: string;
  color_token: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  statuses: CustomStatus[];
}

interface CreateProductInput {
  name: string;
  label: string;
  colorToken: string;
  statuses: { name: string; label: string }[];
}

export function useCustomProducts() {
  const [customProducts, setCustomProducts] = useState<CustomProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const [productsRes, statusesRes] = await Promise.all([
      supabase.from('custom_products').select('*').order('created_at', { ascending: true }),
      supabase.from('custom_statuses').select('*').order('order_index', { ascending: true }),
    ]);

    if (productsRes.error || statusesRes.error) {
      setCustomProducts([]);
      setLoading(false);
      return;
    }

    const merged: CustomProduct[] = (productsRes.data ?? []).map((p) => ({
      ...p,
      statuses: (statusesRes.data ?? []).filter((s) => s.custom_product_id === p.id),
    }));
    setCustomProducts(merged);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const createCustomProduct = async (input: CreateProductInput): Promise<CustomProduct | null> => {
    const { data: product, error: pErr } = await supabase
      .from('custom_products')
      .insert({
        name: input.name,
        label: input.label,
        color_token: input.colorToken,
      })
      .select()
      .single();

    if (pErr || !product) throw pErr ?? new Error('Insert failed');

    if (input.statuses.length > 0) {
      const rows = input.statuses.map((s, idx) => ({
        custom_product_id: product.id,
        name: s.name,
        label: s.label,
        order_index: idx,
      }));
      const { error: sErr } = await supabase.from('custom_statuses').insert(rows);
      if (sErr) throw sErr;
    }

    await fetch();
    return product as unknown as CustomProduct;
  };

  const updateCustomProduct = async (
    id: string,
    patch: Partial<Pick<CustomProduct, 'label' | 'color_token'>>
  ) => {
    const { error } = await supabase
      .from('custom_products')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    await fetch();
  };

  const deleteCustomProduct = async (id: string) => {
    const { error } = await supabase.from('custom_products').delete().eq('id', id);
    if (error) throw error;
    await fetch();
  };

  const addCustomStatus = async (
    customProductId: string,
    status: { name: string; label: string }
  ) => {
    const product = customProducts.find((p) => p.id === customProductId);
    const orderIndex = product ? product.statuses.length : 0;
    const { error } = await supabase.from('custom_statuses').insert({
      custom_product_id: customProductId,
      name: status.name,
      label: status.label,
      order_index: orderIndex,
    });
    if (error) throw error;
    await fetch();
  };

  const updateCustomStatus = async (
    id: string,
    patch: Partial<Pick<CustomStatus, 'label' | 'order_index'>>
  ) => {
    const { error } = await supabase.from('custom_statuses').update(patch).eq('id', id);
    if (error) throw error;
    await fetch();
  };

  const deleteCustomStatus = async (id: string) => {
    const { error } = await supabase.from('custom_statuses').delete().eq('id', id);
    if (error) throw error;
    await fetch();
  };

  return {
    customProducts,
    loading,
    refresh: fetch,
    createCustomProduct,
    updateCustomProduct,
    deleteCustomProduct,
    addCustomStatus,
    updateCustomStatus,
    deleteCustomStatus,
  };
}
