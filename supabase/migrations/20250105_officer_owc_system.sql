-- Officer Work Credit (OWC) Pay System
-- New pay structure with OWC and conversion rates

-- Add OWC-related columns to user_profiles
DO $$ 
BEGIN
  -- Add officer_level if it doesn't exist (should support levels 1-5 now)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'officer_level') THEN
    ALTER TABLE user_profiles ADD COLUMN officer_level INTEGER DEFAULT 1 CHECK (officer_level >= 1 AND officer_level <= 5);
  ELSE
    -- Update check constraint to allow level 5
    ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_officer_level_check;
    ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_officer_level_check CHECK (officer_level >= 1 AND officer_level <= 5);
  END IF;

  -- Add OWC balance
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'owc_balance') THEN
    ALTER TABLE user_profiles ADD COLUMN owc_balance BIGINT DEFAULT 0;
  END IF;

  -- Add total OWC earned (lifetime)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'total_owc_earned') THEN
    ALTER TABLE user_profiles ADD COLUMN total_owc_earned BIGINT DEFAULT 0;
  END IF;
END $$;

-- Create OWC transaction log table
CREATE TABLE IF NOT EXISTS owc_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('earned', 'converted', 'bonus', 'deducted')),
  source TEXT, -- 'shift', 'conversion', 'bonus', etc.
  session_id UUID REFERENCES officer_work_sessions(id) ON DELETE SET NULL,
  conversion_rate NUMERIC(5, 4), -- e.g., 0.005 for 0.5%
  paid_coins_received BIGINT, -- If converted, how many paid coins
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_owc_transactions_user ON owc_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_owc_transactions_created ON owc_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_owc_transactions_type ON owc_transactions(transaction_type);

-- Update officer_work_sessions to track OWC
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'officer_work_sessions' AND column_name = 'owc_earned') THEN
    ALTER TABLE officer_work_sessions ADD COLUMN owc_earned BIGINT DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'officer_work_sessions' AND column_name = 'paid_coins_converted') THEN
    ALTER TABLE officer_work_sessions ADD COLUMN paid_coins_converted BIGINT DEFAULT 0;
  END IF;
END $$;

-- Function to get OWC rate per hour based on officer level
CREATE OR REPLACE FUNCTION get_owc_per_hour(p_level INTEGER)
RETURNS BIGINT AS $$
BEGIN
  RETURN CASE
    WHEN p_level = 1 THEN 1000000  -- Junior Officer
    WHEN p_level = 2 THEN 1500000  -- Senior Officer
    WHEN p_level = 3 THEN 1800000  -- Commander
    WHEN p_level = 4 THEN 2200000  -- Elite Commander
    WHEN p_level = 5 THEN 2600000  -- HQ Master Officer
    ELSE 1000000
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get conversion rate based on officer level
CREATE OR REPLACE FUNCTION get_owc_conversion_rate(p_level INTEGER)
RETURNS NUMERIC AS $$
BEGIN
  RETURN CASE
    WHEN p_level = 1 THEN 0.005  -- 0.5%
    WHEN p_level = 2 THEN 0.007  -- 0.7%
    WHEN p_level = 3 THEN 0.008  -- 0.8%
    WHEN p_level = 4 THEN 0.009  -- 0.9%
    WHEN p_level = 5 THEN 0.011  -- 1.1%
    ELSE 0.005
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate paid coins from OWC (with 10% bonus)
CREATE OR REPLACE FUNCTION convert_owc_to_paid_coins(p_owc BIGINT, p_level INTEGER)
RETURNS BIGINT AS $$
DECLARE
  v_conversion_rate NUMERIC;
  v_base_paid_coins BIGINT;
  v_bonus_coins BIGINT;
BEGIN
  v_conversion_rate := get_owc_conversion_rate(p_level);
  v_base_paid_coins := FLOOR(p_owc * v_conversion_rate);
  v_bonus_coins := FLOOR(v_base_paid_coins * 0.10); -- 10% bonus
  RETURN v_base_paid_coins + v_bonus_coins;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to award OWC for a work session
CREATE OR REPLACE FUNCTION award_owc_for_session(
  p_session_id UUID,
  p_user_id UUID,
  p_hours_worked NUMERIC,
  p_officer_level INTEGER
)
RETURNS BIGINT AS $$
DECLARE
  v_owc_per_hour BIGINT;
  v_owc_earned BIGINT;
BEGIN
  v_owc_per_hour := get_owc_per_hour(p_officer_level);
  v_owc_earned := FLOOR(v_owc_per_hour * p_hours_worked);

  -- Update session
  UPDATE officer_work_sessions
  SET owc_earned = v_owc_earned
  WHERE id = p_session_id;

  -- Update user profile
  UPDATE user_profiles
  SET 
    owc_balance = owc_balance + v_owc_earned,
    total_owc_earned = total_owc_earned + v_owc_earned
  WHERE id = p_user_id;

  -- Log transaction
  INSERT INTO owc_transactions (user_id, amount, transaction_type, source, session_id)
  VALUES (p_user_id, v_owc_earned, 'earned', 'shift', p_session_id);

  RETURN v_owc_earned;
END;
$$ LANGUAGE plpgsql;

-- Function to convert OWC to paid coins
CREATE OR REPLACE FUNCTION convert_owc_to_paid(
  p_user_id UUID,
  p_owc_amount BIGINT
)
RETURNS JSON AS $$
DECLARE
  v_current_owc BIGINT;
  v_officer_level INTEGER;
  v_conversion_rate NUMERIC;
  v_base_paid_coins BIGINT;
  v_bonus_coins BIGINT;
  v_total_paid_coins BIGINT;
BEGIN
  -- Get current OWC balance and officer level
  SELECT owc_balance, officer_level
  INTO v_current_owc, v_officer_level
  FROM user_profiles
  WHERE id = p_user_id;

  IF v_current_owc < p_owc_amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient OWC balance');
  END IF;

  IF v_officer_level IS NULL OR v_officer_level < 1 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid officer level');
  END IF;

  -- Calculate conversion
  v_conversion_rate := get_owc_conversion_rate(v_officer_level);
  v_base_paid_coins := FLOOR(p_owc_amount * v_conversion_rate);
  v_bonus_coins := FLOOR(v_base_paid_coins * 0.10); -- 10% bonus
  v_total_paid_coins := v_base_paid_coins + v_bonus_coins;

  -- Deduct OWC and add paid coins
  UPDATE user_profiles
  SET 
    owc_balance = owc_balance - p_owc_amount,
    paid_coin_balance = COALESCE(paid_coin_balance, 0) + v_total_paid_coins
  WHERE id = p_user_id;

  -- Log conversion transaction
  INSERT INTO owc_transactions (
    user_id, 
    amount, 
    transaction_type, 
    source, 
    conversion_rate, 
    paid_coins_received
  )
  VALUES (
    p_user_id, 
    -p_owc_amount, 
    'converted', 
    'manual_conversion', 
    v_conversion_rate, 
    v_total_paid_coins
  );

  -- Log bonus transaction
  INSERT INTO owc_transactions (
    user_id, 
    amount, 
    transaction_type, 
    source, 
    paid_coins_received
  )
  VALUES (
    p_user_id, 
    v_bonus_coins, 
    'bonus', 
    'conversion_bonus', 
    v_bonus_coins
  );

  RETURN json_build_object(
    'success', true,
    'owc_converted', p_owc_amount,
    'base_paid_coins', v_base_paid_coins,
    'bonus_coins', v_bonus_coins,
    'total_paid_coins', v_total_paid_coins,
    'conversion_rate', v_conversion_rate
  );
END;
$$ LANGUAGE plpgsql;

-- Update officer badge mapping for new levels
CREATE OR REPLACE FUNCTION update_officer_tier_badge()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.officer_level IS NOT NULL THEN
    NEW.officer_tier_badge := CASE
      WHEN NEW.officer_level = 1 THEN 'blue'
      WHEN NEW.officer_level = 2 THEN 'orange'
      WHEN NEW.officer_level = 3 THEN 'red'
      WHEN NEW.officer_level = 4 THEN 'purple'
      WHEN NEW.officer_level = 5 THEN 'gold'
      ELSE 'blue'
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update existing officers to have correct badge
UPDATE user_profiles
SET officer_tier_badge = CASE
  WHEN officer_level = 1 THEN 'blue'
  WHEN officer_level = 2 THEN 'orange'
  WHEN officer_level = 3 THEN 'red'
  WHEN officer_level = 4 THEN 'purple'
  WHEN officer_level = 5 THEN 'gold'
  ELSE 'blue'
END
WHERE (is_troll_officer = TRUE OR role = 'troll_officer')
AND officer_tier_badge IS NULL;

