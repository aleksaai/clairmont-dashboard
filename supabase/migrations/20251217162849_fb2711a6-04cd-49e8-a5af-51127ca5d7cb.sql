-- Add new status values to case_status enum
ALTER TYPE case_status ADD VALUE IF NOT EXISTS 'anfrage_eingegangen';
ALTER TYPE case_status ADD VALUE IF NOT EXISTS 'prognose_erstellt';
ALTER TYPE case_status ADD VALUE IF NOT EXISTS 'angebot_gesendet';
ALTER TYPE case_status ADD VALUE IF NOT EXISTS 'anzahlung_erhalten';
ALTER TYPE case_status ADD VALUE IF NOT EXISTS 'einspruch_nacharbeit';