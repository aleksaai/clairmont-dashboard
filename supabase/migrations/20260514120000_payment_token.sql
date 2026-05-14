-- Add payment_token to folders for the customer-facing Payment Portal.
-- Permanent UUID per folder; replaces the ephemeral Stripe-session URL as the
-- customer's link target. Existing rows get an auto-generated token via DEFAULT.

ALTER TABLE folders
  ADD COLUMN payment_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX idx_folders_payment_token ON folders(payment_token);
