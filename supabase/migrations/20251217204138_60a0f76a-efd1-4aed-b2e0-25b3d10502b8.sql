-- Make created_by nullable for system uploads (webhook)
ALTER TABLE public.folders ALTER COLUMN created_by DROP NOT NULL;

-- Make uploaded_by nullable for system uploads (webhook)
ALTER TABLE public.documents ALTER COLUMN uploaded_by DROP NOT NULL;

-- Add RLS policy for service role to insert folders without user
CREATE POLICY "Service role can manage all folders" 
ON public.folders 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Add RLS policy for service role to insert documents without user
CREATE POLICY "Service role can manage all documents" 
ON public.documents 
FOR ALL 
USING (true)
WITH CHECK (true);