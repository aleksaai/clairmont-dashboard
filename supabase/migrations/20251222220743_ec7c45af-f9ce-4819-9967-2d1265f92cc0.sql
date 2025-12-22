-- Add new status "rueckstand" for customers behind on payments
ALTER TYPE public.case_status ADD VALUE IF NOT EXISTS 'rueckstand';