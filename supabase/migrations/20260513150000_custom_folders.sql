-- Phase 2: Admin-managed custom folder categories (parallel to the
-- product_type / case_status enum world).
--
-- A custom folder has its own pipeline (custom_statuses, ordered) and
-- its own preset color token. Folders pick EITHER (product + status)
-- OR (custom_product_id + custom_status_id), never both.

------------------------------------------------------------
-- 1. custom_products
------------------------------------------------------------
CREATE TABLE public.custom_products (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,             -- machine slug, lowercase
  label       text NOT NULL,                    -- display label
  color_token text NOT NULL DEFAULT 'blue',     -- preset color key (frontend maps to Tailwind classes)
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "custom_products_select_all_authenticated"
  ON public.custom_products FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "custom_products_admin_manage"
  ON public.custom_products FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

------------------------------------------------------------
-- 2. custom_statuses
------------------------------------------------------------
CREATE TABLE public.custom_statuses (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_product_id uuid NOT NULL REFERENCES public.custom_products(id) ON DELETE CASCADE,
  name              text NOT NULL,                  -- machine slug, lowercase per product
  label             text NOT NULL,
  order_index       int  NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (custom_product_id, name)
);

CREATE INDEX custom_statuses_product_order_idx
  ON public.custom_statuses (custom_product_id, order_index);

ALTER TABLE public.custom_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "custom_statuses_select_all_authenticated"
  ON public.custom_statuses FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "custom_statuses_admin_manage"
  ON public.custom_statuses FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

------------------------------------------------------------
-- 3. folders gets parallel custom-world columns
------------------------------------------------------------
ALTER TABLE public.folders
  ADD COLUMN custom_product_id uuid REFERENCES public.custom_products(id) ON DELETE RESTRICT,
  ADD COLUMN custom_status_id  uuid REFERENCES public.custom_statuses(id)  ON DELETE RESTRICT;

-- product + status become optional so a folder can live in the custom world only
ALTER TABLE public.folders ALTER COLUMN product DROP NOT NULL;
ALTER TABLE public.folders ALTER COLUMN status  DROP NOT NULL;

-- Index so per-product queries are fast on the custom side too
CREATE INDEX folders_custom_product_idx ON public.folders (custom_product_id)
  WHERE custom_product_id IS NOT NULL;

------------------------------------------------------------
-- 4. user_custom_product_visibility
--    parallel to user_product_visibility, for the custom world
------------------------------------------------------------
CREATE TABLE public.user_custom_product_visibility (
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  custom_product_id uuid NOT NULL REFERENCES public.custom_products(id) ON DELETE CASCADE,
  is_visible        boolean NOT NULL DEFAULT true,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, custom_product_id)
);

ALTER TABLE public.user_custom_product_visibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_custom_product_visibility_select_own"
  ON public.user_custom_product_visibility FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_custom_product_visibility_insert_own"
  ON public.user_custom_product_visibility FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_custom_product_visibility_update_own"
  ON public.user_custom_product_visibility FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_custom_product_visibility_delete_own"
  ON public.user_custom_product_visibility FOR DELETE
  USING (auth.uid() = user_id);
