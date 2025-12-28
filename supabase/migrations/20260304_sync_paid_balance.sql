-- Keep paid_coin_balance available for legacy queries while troll_coins is authoritative
BEGIN;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS paid_coin_balance bigint NOT NULL DEFAULT 0;

UPDATE user_profiles
SET paid_coin_balance = COALESCE(troll_coins, 0);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'paid_coin_balance'
  ) THEN
    CREATE OR REPLACE FUNCTION sync_paid_coin_balance()
    RETURNS trigger AS $func$
    BEGIN
      NEW.paid_coin_balance := NEW.troll_coins;
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_sync_paid_balance ON user_profiles;
    CREATE TRIGGER trg_sync_paid_balance
    BEFORE INSERT OR UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION sync_paid_coin_balance();
  END IF;
END;
$$;

COMMIT;
