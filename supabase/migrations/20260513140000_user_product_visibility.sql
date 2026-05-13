-- Per-user visibility settings for product folders on the dashboard.
-- Admins + Sachbearbeiter manage this themselves via the OrdnerView
-- settings popover. Vertriebler do NOT use this table — their visible
-- set is computed live (default 4 + any product that has folders
-- assigned to one of their partner codes).

CREATE TABLE IF NOT EXISTS public.user_product_visibility (
  user_id    uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product    product_type  NOT NULL,
  is_visible boolean       NOT NULL DEFAULT true,
  updated_at timestamptz   NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product)
);

ALTER TABLE public.user_product_visibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_product_visibility_select_own"
  ON public.user_product_visibility FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_product_visibility_insert_own"
  ON public.user_product_visibility FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_product_visibility_update_own"
  ON public.user_product_visibility FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_product_visibility_delete_own"
  ON public.user_product_visibility FOR DELETE
  USING (auth.uid() = user_id);
