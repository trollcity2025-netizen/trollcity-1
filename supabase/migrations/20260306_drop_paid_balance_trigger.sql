-- Migration: Remove paid_coin_balance trigger and column (troll_coins is authoritative)
-- Date: 2026-03-06

BEGIN;

DROP TRIGGER IF EXISTS trg_sync_paid_balance ON user_profiles;
DROP FUNCTION IF EXISTS sync_paid_coin_balance();

ALTER TABLE user_profiles
DROP COLUMN IF EXISTS paid_coin_balance;

COMMIT;
