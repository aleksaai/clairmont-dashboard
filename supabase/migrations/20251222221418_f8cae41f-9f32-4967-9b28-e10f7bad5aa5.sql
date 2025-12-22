-- Add columns to track installment payment progress
ALTER TABLE public.folders 
ADD COLUMN IF NOT EXISTS installments_paid integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS next_payment_date timestamp with time zone DEFAULT NULL;