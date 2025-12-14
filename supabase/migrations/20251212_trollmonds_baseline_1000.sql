-- Trollmonds Baseline to 1000
-- Ensure every user (existing and new) has at least 1,000 Trollmonds

-- 1) Make sure wallets has a trollmonds column and default
ALTER TABLE wallets
ADD COLUMN IF NOT EXISTS trollmonds bigint NOT NULL DEFAULT 0;

ALTER TABLE wallets
ALTER COLUMN trollmonds SET DEFAULT 1000;

-- 2) Ensure user_profiles default is 1000
ALTER TABLE user_profiles
ALTER COLUMN trollmonds SET DEFAULT 1000;

-- 3) Backfill existing balances without reducing higher balances
UPDATE user_profiles
SET trollmonds = GREATEST(COALESCE(trollmonds, 0), 1000);

UPDATE wallets
SET trollmonds = GREATEST(COALESCE(trollmonds, 0), 1000);
