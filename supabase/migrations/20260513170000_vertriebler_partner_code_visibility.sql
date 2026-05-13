-- Consolidate the Vertriebler visibility rules for folders/documents
-- into one combined policy each (assigned_to OR created_by OR matching
-- partner_code). Behavior was already correct via two parallel
-- policies; this just keeps the schema clean.

-- folders
DROP POLICY IF EXISTS "Vertriebler can view assigned folders" ON public.folders;
DROP POLICY IF EXISTS "Vertriebler can view folders with their partner code" ON public.folders;

CREATE POLICY "Vertriebler can view assigned or partner folders"
  ON public.folders FOR SELECT
  USING (
    has_role(auth.uid(), 'vertriebler') AND (
      assigned_to = auth.uid()
      OR created_by = auth.uid()
      OR (
        partner_code IS NOT NULL
        AND partner_code IN (
          SELECT code FROM public.partner_codes WHERE user_id = auth.uid()
        )
      )
    )
  );

-- documents
DROP POLICY IF EXISTS "Vertriebler can manage documents in their folders" ON public.documents;
DROP POLICY IF EXISTS "Vertriebler can manage documents in their partner code folders" ON public.documents;

CREATE POLICY "Vertriebler can manage documents in their folders"
  ON public.documents FOR ALL
  USING (
    has_role(auth.uid(), 'vertriebler') AND EXISTS (
      SELECT 1 FROM public.folders
      WHERE folders.id = documents.folder_id
        AND (
          folders.assigned_to = auth.uid()
          OR folders.created_by = auth.uid()
          OR (
            folders.partner_code IS NOT NULL
            AND folders.partner_code IN (
              SELECT code FROM public.partner_codes WHERE user_id = auth.uid()
            )
          )
        )
    )
  );
