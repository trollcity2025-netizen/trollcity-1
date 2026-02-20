-- Migration: add preferred payment fields and ensure purchase transaction_id uniqueness
-- Adds `preferred_payment_method` and `braintree_customer_id` to user_profiles
-- Ensures `coin_purchases.transaction_id` exists and is unique for non-null values

BEGIN;

ALTER TABLE IF EXISTS public.user_profiles
  ADD COLUMN IF NOT EXISTS preferred_payment_method text,
  ADD COLUMN IF NOT EXISTS braintree_customer_id text;

ALTER TABLE IF EXISTS public.coin_purchases
  ADD COLUMN IF NOT EXISTS transaction_id text;

-- Create a unique partial index so multiple NULL transaction_ids are allowed
CREATE UNIQUE INDEX IF NOT EXISTS uq_coin_purchases_transaction_id
  ON public.coin_purchases (transaction_id)
  WHERE transaction_id IS NOT NULL;

COMMIT;

-- Notes:
-- - Run this against your Supabase/Postgres instance. If you use a migration runner that
--   disallows running CREATE INDEX in the same transaction as DDL, split the statements
--   accordingly or run the index creation separately.
