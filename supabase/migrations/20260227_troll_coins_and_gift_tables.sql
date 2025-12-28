BEGIN;

-- Ensure troll_coins column exists and mirrors troll_coin_balance
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'troll_coins'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN troll_coins BIGINT DEFAULT 0 NOT NULL;
  END IF;
END;
$$;

UPDATE user_profiles
SET troll_coins = COALESCE(troll_coins, paid_coin_balance, 0);

CREATE OR REPLACE FUNCTION sync_troll_coins_paid_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  base_balance BIGINT;
BEGIN
  base_balance := COALESCE(
    NEW.troll_coins,
    NEW.paid_coin_balance,
    OLD.troll_coins,
    OLD.paid_coin_balance,
    0
  );

  NEW.troll_coins := base_balance;
  NEW.paid_coin_balance := base_balance;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_troll_coins_paid_balance ON user_profiles;
CREATE TRIGGER trg_sync_troll_coins_paid_balance
  BEFORE INSERT OR UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_troll_coins_paid_balance();

-- Track player inventories
CREATE TABLE IF NOT EXISTS gifts_owned (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  gift_slug TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gifts_owned_user_gift ON gifts_owned(user_id, gift_slug);

CREATE OR REPLACE FUNCTION refresh_gifts_owned_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_gifts_owned_timestamp ON gifts_owned;
CREATE TRIGGER trg_refresh_gifts_owned_timestamp
  BEFORE UPDATE ON gifts_owned
  FOR EACH ROW
  EXECUTE FUNCTION refresh_gifts_owned_timestamp();

ALTER TABLE gifts_owned ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own gifts" ON gifts_owned
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Ledger for every gift send/receive
CREATE TABLE IF NOT EXISTS gift_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  gift_slug TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('sent','received')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  coins_value BIGINT NOT NULL,
  target_id UUID,
  stream_id UUID,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gift_transactions_user_id ON gift_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_gift_transactions_stream_id ON gift_transactions(stream_id);

ALTER TABLE gift_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated gift ledger insert" ON gift_transactions
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');
CREATE POLICY "Users read their gift ledger" ON gift_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Optional catalog table (future sync from catalog file)
CREATE TABLE IF NOT EXISTS gift_catalog (
  gift_slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  animation_type TEXT,
  coin_cost INTEGER NOT NULL,
  tier TEXT,
  category TEXT,
  description TEXT,
  popularity_score INTEGER,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE gift_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public gift catalog" ON gift_catalog
  FOR SELECT
  USING (true);

COMMIT;
