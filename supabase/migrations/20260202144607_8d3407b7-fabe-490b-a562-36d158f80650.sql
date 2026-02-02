-- RLS Policy: All authenticated users can view problem cases
CREATE POLICY "All users can view problem cases"
ON public.folders
FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND product = 'problemfall'
);

-- RLS Policy: All authenticated users can create problem cases
CREATE POLICY "All users can create problem cases"
ON public.folders
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND product = 'problemfall'
);

-- RLS Policy: All authenticated users can update problem cases (status changes)
CREATE POLICY "All users can update problem cases"
ON public.folders
FOR UPDATE
USING (
  auth.uid() IS NOT NULL 
  AND product = 'problemfall'
)
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND product = 'problemfall'
);