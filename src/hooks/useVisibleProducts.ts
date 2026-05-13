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
  product: ProductType | null;
  partner_code: string | null;
  custom_product_id: string | null;
}

interface CustomProductRef {
  id: string;
}

export function useVisibleProducts(
  userId: string | undefined,
  role: AppRole | null,
  folders: FolderForVisibility[],
  customProducts: CustomProductRef[]
) {
  const [visibilityMap, setVisibilityMap] = useState<Record<ProductType, boolean> | null>(null);
  const [customVisibilityMap, setCustomVisibilityMap] = useState<Record<string, boolean> | null>(
    null
  );
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

    // admin + sachbearbeiter — load saved settings (both worlds)
    const [nativeRowsRes, customRowsRes] = await Promise.all([
      supabase
        .from('user_product_visibility')
        .select('product, is_visible')
        .eq('user_id', userId),
      supabase
        .from('user_custom_product_visibility')
        .select('custom_product_id, is_visible')
        .eq('user_id', userId),
    ]);

    const nativeRows = nativeRowsRes.data;
    const customRows = customRowsRes.data;

    // ----- Native products -----
    if (!nativeRows || nativeRows.length === 0) {
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
        const row = nativeRows.find((r) => r.product === p);
        map[p] = row ? row.is_visible : DEFAULT_VISIBLE_PRODUCTS.includes(p);
      });
      setVisibilityMap(map);
    }

    // ----- Custom products -----
    // New custom products default to visible for admin/sachbearbeiter.
    const cMap: Record<string, boolean> = {};
    customProducts.forEach((cp) => {
      const row = customRows?.find((r) => r.custom_product_id === cp.id);
      cMap[cp.id] = row ? row.is_visible : true;
    });
    setCustomVisibilityMap(cMap);

    setLoading(false);
  }, [userId, role, customProducts]);

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

  const toggleCustomVisibility = async (customProductId: string, isVisible: boolean) => {
    if (!userId || role === 'vertriebler' || !role) return;
    setCustomVisibilityMap((prev) => (prev ? { ...prev, [customProductId]: isVisible } : null));
    const { error } = await supabase
      .from('user_custom_product_visibility')
      .upsert(
        {
          user_id: userId,
          custom_product_id: customProductId,
          is_visible: isVisible,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,custom_product_id' }
      );
    if (error) {
      setCustomVisibilityMap((prev) =>
        prev ? { ...prev, [customProductId]: !isVisible } : null
      );
      throw error;
    }
  };

  const visibleProducts = useMemo<ProductType[]>(() => {
    if (role === 'vertriebler') {
      const codeSet = new Set(partnerCodes);
      const autoShow = new Set<ProductType>();
      folders.forEach((f) => {
        if (f.product && f.partner_code && codeSet.has(f.partner_code)) {
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

  const visibleCustomProductIds = useMemo<Set<string>>(() => {
    if (role === 'vertriebler') {
      const codeSet = new Set(partnerCodes);
      const out = new Set<string>();
      folders.forEach((f) => {
        if (f.custom_product_id && f.partner_code && codeSet.has(f.partner_code)) {
          out.add(f.custom_product_id);
        }
      });
      return out;
    }

    if (customVisibilityMap) {
      return new Set(
        Object.entries(customVisibilityMap)
          .filter(([, visible]) => visible)
          .map(([id]) => id)
      );
    }

    return new Set(customProducts.map((cp) => cp.id));
  }, [role, partnerCodes, folders, customVisibilityMap, customProducts]);

  return {
    visibleProducts,
    visibilityMap,
    toggleVisibility,
    visibleCustomProductIds,
    customVisibilityMap,
    toggleCustomVisibility,
    loading,
    canManageVisibility: role === 'admin' || role === 'sachbearbeiter',
    isAdmin: role === 'admin',
  };
}
