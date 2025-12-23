-- Add payment_selection_token to folders table for secure public access
ALTER TABLE public.folders 
ADD COLUMN IF NOT EXISTS payment_selection_token uuid DEFAULT gen_random_uuid();

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_folders_payment_selection_token ON public.folders(payment_selection_token);

-- Create RLS policy for public token-based access (will be used via edge function with service role)
-- No direct public access needed since we use edge functions