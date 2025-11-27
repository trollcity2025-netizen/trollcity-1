-- Add new transaction columns for revenue/liability tracking
BEGIN;

ALTER TABLE public.coin_transactions
  ADD COLUMN IF NOT EXISTS coin_type TEXT CHECK (coin_type IN ('paid','free')) DEFAULT 'paid',
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS platform_profit NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS liability NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';

-- Expand allowed types (if using CHECK constraint replace, here we'll create a new constraint)
ALTER TABLE public.coin_transactions DROP CONSTRAINT IF EXISTS coin_transactions_type_check;
ALTER TABLE public.coin_transactions
  ADD CONSTRAINT coin_transactions_type_check CHECK (type IN ('store_purchase','perk_purchase','gift_send','gift_receive','kick_fee','ban_fee','cashout','wheel_spin','insurance_purchase'));

-- Views for reporting
CREATE OR REPLACE VIEW public.v_total_profit AS
SELECT
  COALESCE(SUM(platform_profit),0) AS total_profit_usd,
  COUNT(*) AS tx_count
FROM public.coin_transactions;

CREATE OR REPLACE VIEW public.v_total_liability AS
SELECT
  COALESCE(SUM(liability),0) AS total_liability_coins
FROM public.coin_transactions;

CREATE OR REPLACE VIEW public.v_kick_ban_revenue AS
SELECT
  COALESCE(SUM(platform_profit),0) AS kick_ban_profit
FROM public.coin_transactions
WHERE type IN ('kick_fee','ban_fee');

CREATE OR REPLACE VIEW public.v_broadcaster_balances AS
SELECT
  u.id as broadcaster_id,
  u.username,
  COALESCE(SUM(ct.amount),0) FILTER (WHERE ct.type = 'gift_receive' AND ct.coin_type = 'paid') AS paid_coins_received
FROM public.user_profiles u
LEFT JOIN public.coin_transactions ct ON ct.user_id = u.id
GROUP BY u.id, u.username
ORDER BY paid_coins_received DESC;

COMMIT;
