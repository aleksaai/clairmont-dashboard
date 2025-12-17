-- Fix overly-permissive Service Role policies (were applied to PUBLIC)
DROP POLICY IF EXISTS "Service role can manage all folders" ON public.folders;
CREATE POLICY "Service role can manage all folders"
ON public.folders
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage all documents" ON public.documents;
CREATE POLICY "Service role can manage all documents"
ON public.documents
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Enforce partner-code visibility for Vertriebler
DROP POLICY IF EXISTS "Vertriebler can view folders with their partner code" ON public.folders;
CREATE POLICY "Vertriebler can view folders with their partner code"
ON public.folders
FOR SELECT
USING (
  has_role(auth.uid(), 'vertriebler'::app_role)
  AND partner_code IS NOT NULL
  AND partner_code IN (
    SELECT code
    FROM public.partner_codes
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Vertriebler can manage documents in their folders" ON public.documents;
CREATE POLICY "Vertriebler can manage documents in their partner code folders"
ON public.documents
FOR ALL
USING (
  has_role(auth.uid(), 'vertriebler'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.folders f
    WHERE f.id = documents.folder_id
      AND f.partner_code IS NOT NULL
      AND f.partner_code IN (
        SELECT code
        FROM public.partner_codes
        WHERE user_id = auth.uid()
      )
  )
)
WITH CHECK (
  has_role(auth.uid(), 'vertriebler'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.folders f
    WHERE f.id = documents.folder_id
      AND f.partner_code IS NOT NULL
      AND f.partner_code IN (
        SELECT code
        FROM public.partner_codes
        WHERE user_id = auth.uid()
      )
  )
);
