-- Gift Box full system: Sav/Vived bonus tracking and app-sponsored gifts

-- Track per-user bonus coins earned from Sav and Vived promo gifts
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS sav_bonus_coins INTEGER NOT NULL DEFAULT 0 CHECK (sav_bonus_coins >= 0);

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS vived_bonus_coins INTEGER NOT NULL DEFAULT 0 CHECK (vived_bonus_coins >= 0);

-- Ensure transactions table has promo-related columns (safe IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'stream_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN stream_id UUID;
  END IF;

  -- Columns for app-sponsored promo gifts (Sav/Vived)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'gift_beneficiary'
  ) THEN
    ALTER TABLE transactions ADD COLUMN gift_beneficiary UUID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'is_app_sponsored'
  ) THEN
    ALTER TABLE transactions ADD COLUMN is_app_sponsored BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'amount_usd'
  ) THEN
    ALTER TABLE transactions ADD COLUMN amount_usd NUMERIC(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'coins_used'
  ) THEN
    ALTER TABLE transactions ADD COLUMN coins_used INTEGER;
  END IF;
END $$;
