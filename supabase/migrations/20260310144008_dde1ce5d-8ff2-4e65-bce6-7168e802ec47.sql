
-- Sachbearbeiter can insert documents into any folder
CREATE POLICY "Sachbearbeiter can insert documents"
ON public.documents
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'sachbearbeiter'::app_role));
