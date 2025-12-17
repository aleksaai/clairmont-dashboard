-- Drop existing policy for Vertriebler viewing folders
DROP POLICY IF EXISTS "Vertriebler can view assigned folders" ON public.folders;

-- Create new policy: Vertriebler see only folders with their partner code
CREATE POLICY "Vertriebler can view folders with their partner code" 
ON public.folders 
FOR SELECT 
USING (
  has_role(auth.uid(), 'vertriebler'::app_role) 
  AND (
    -- They created it
    created_by = auth.uid() 
    OR 
    -- They are assigned to it
    assigned_to = auth.uid()
    OR
    -- The folder's partner_code matches their partner_code
    (
      partner_code IS NOT NULL 
      AND partner_code IN (
        SELECT code FROM public.partner_codes WHERE user_id = auth.uid()
      )
    )
  )
);