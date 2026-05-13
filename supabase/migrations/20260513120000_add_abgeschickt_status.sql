-- Add 'abgeschickt' status between 'bezahlt' and 'einspruch_nacharbeit'
-- for the Steuerfälle workflow.
ALTER TYPE public.case_status ADD VALUE IF NOT EXISTS 'abgeschickt' AFTER 'bezahlt';
