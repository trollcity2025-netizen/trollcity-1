-- Ensure Trollmonds and legacy free coin balances stay aligned for store purchases.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'user_profiles'
      AND column_name = 'trollmonds'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN trollmonds BIGINT DEFAULT 0 NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'user_profiles'
      AND column_name = 'free_coin_balance'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN free_coin_balance BIGINT DEFAULT 0 NOT NULL;
  END IF;
END;
$$;

-- Keep both columns synchronized
UPDATE user_profiles
SET
  trollmonds = COALESCE(trollmonds, free_coin_balance, 0),
  free_coin_balance = COALESCE(trollmonds, free_coin_balance, 0);

CREATE OR REPLACE FUNCTION sync_user_profiles_trollmonds_free()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  synced_balance BIGINT;
BEGIN
  synced_balance := COALESCE(
    NEW.trollmonds,
    NEW.free_coin_balance,
    OLD.trollmonds,
    OLD.free_coin_balance,
    0
  );
  NEW.trollmonds := synced_balance;
  NEW.free_coin_balance := synced_balance;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_trollmonds_free_balance ON user_profiles;
CREATE TRIGGER trg_sync_trollmonds_free_balance
  BEFORE INSERT OR UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_profiles_trollmonds_free();

COMMIT;
