-- Add prognose and payment fields to folders table
ALTER TABLE public.folders
ADD COLUMN prognose_amount NUMERIC(10, 2) DEFAULT NULL,
ADD COLUMN prognose_created_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN payment_link_url TEXT DEFAULT NULL,
ADD COLUMN payment_status TEXT DEFAULT NULL;

-- Add check constraint for payment_status
ALTER TABLE public.folders
ADD CONSTRAINT folders_payment_status_check 
CHECK (payment_status IS NULL OR payment_status IN ('pending', 'paid', 'failed'));

-- Create index for payment status queries
CREATE INDEX idx_folders_payment_status ON public.folders(payment_status) WHERE payment_status IS NOT NULL;