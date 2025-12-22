-- Add installment columns to folders table
ALTER TABLE public.folders 
ADD COLUMN IF NOT EXISTS installment_count integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS installment_fee numeric DEFAULT 0;