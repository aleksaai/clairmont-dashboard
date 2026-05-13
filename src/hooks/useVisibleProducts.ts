import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole } from './useAuth';

export type ProductType =
  | 'steuern'
  | 'kredit'
  | 'versicherung'
  | 'problemfall'
  | 'global_sourcing'
  | 'unternehmensberatung'
  | 'ai_due_diligence'
  | 'payment_solutions'
  | 'solaranlagen'
  | 'immobilien'
  | 'rechtsberatung'
  | 'sonstiges';

export const ALL_PRODUCTS: ProductType[] = [
  'steuern',
  'versicherung',
  'kredit',
  'problemfall',
  'global_sourcing',
  'unternehmensberatung',
  'ai_due_diligence',
  'payment_solutions',
  'solaranlagen',
  'immobilien',
  'rechtsberatung',
  'sonstiges',
];

export const DEFAULT_VISIBLE_PRODUCTS: ProductType[] = [
  'steuern',
  'versicherung',
  'kredit',
  'problemfall',
];

interface FolderForVisibility {
  product: ProductType;
  partner_code: string | null;
}

export function useVisibleProducts(
  userId: string | undefined,
  role: AppRole | null,
  folders: FolderForVisibility[]
) {
  const [visibilityMap, setVisibilityMap] = useState<Record<ProductType, boolean> | null>(null);
  const [partnerCodes, setPartnerCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    if (!userId || !role) {
      setLoading(false);
      return;
    }

    setLoading(true);

    if (role === 'vertriebler') {
      const { data: codes } = await supabase
        .from('partner_codes')
        .select('code')
        .eq('user_id', userId);
      setPartnerCodes(codes?.map((c) => c.code) ?? []);
      setLoading(false);
      return;
    }

    // admin + sachbearbeiter use stored settings
    const { data: rows } = await supabase
      .from('user_product_visibility')
      .select('product, is_visible')
      .eq('user_id', userId);

    if (!rows || rows.length === 0) {
      // First time — seed defaults
      const seedRows = ALL_PRODUCTS.map((product) => ({
        user_id: userId,
        product,
        is_visible: DEFAULT_VISIBLE_PRODUCTS.includes(product),
      }));
      await supabase.from('user_product_visibility').insert(seedRows);
      const map = {} as Record<ProductType, boolean>;
      ALL_PRODUCTS.forEach((p) => {
        map[p] = DEFAULT_VISIBLE_PRODUCTS.includes(p);
      });
      setVisibilityMap(map);
    } else {
      const map = {} as Record<ProductType, boolean>;
      ALL_PRODUCTS.forEach((p) => {
        const row = rows.find((r) => r.product === p);
        map[p] = row ? row.is_visible : DEFAULT_VISIBLE_PRODUCTS.includes(p);
      });
      setVisibilityMap(map);
    }

    setLoading(false);
  }, [userId, role]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const toggleVisibility = async (product: ProductType, isVisible: boolean) => {
    if (!userId || role === 'vertriebler' || !role) return;
    setVisibilityMap((prev) => (prev ? { ...prev, [product]: isVisible } : null));
    const { error } = await supabase
      .from('user_product_visibility')
      .upsert(
        {
          user_id: userId,
          product,
          is_visible: isVisible,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,product' }
      );
    if (error) {
      setVisibilityMap((prev) => (prev ? { ...prev, [product]: !isVisible } : null));
      throw error;
    }
  };

  const visibleProducts = useMemo<ProductType[]>(() => {
    if (role === 'vertriebler') {
      const codeSet = new Set(partnerCodes);
      const autoShow = new Set<ProductType>();
      folders.forEach((f) => {
        if (f.partner_code && codeSet.has(f.partner_code)) {
          autoShow.add(f.product);
        }
      });
      const out = new Set<ProductType>([...DEFAULT_VISIBLE_PRODUCTS, ...autoShow]);
      return ALL_PRODUCTS.filter((p) => out.has(p));
    }

    if (visibilityMap) {
      return ALL_PRODUCTS.filter((p) => visibilityMap[p]);
    }

    return DEFAULT_VISIBLE_PRODUCTS;
  }, [role, partnerCodes, folders, visibilityMap]);

  return {
    visibleProducts,
    visibilityMap,
    toggleVisibility,
    loading,
    canManageVisibility: role === 'admin' || role === 'sachbearbeiter',
  };
}
