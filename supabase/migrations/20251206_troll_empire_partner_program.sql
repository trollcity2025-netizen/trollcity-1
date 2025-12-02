-- Troll Empire Partner Program: Referral Bonus System
-- Creates tables for tracking referrals and monthly bonus payouts

-- Table to track recruiter-referred user relationships
CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (recruiter_id, referred_user_id) -- Prevent duplicate referral relationships
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_referrals_recruiter_id ON referrals(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_user_id ON referrals(referred_user_id);

-- Table to track monthly bonus payouts (prevents double payouts)
CREATE TABLE IF NOT EXISTS referral_monthly_bonus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  month text NOT NULL, -- Format: 'YYYY-MM' e.g. '2025-02'
  coins_earned bigint NOT NULL, -- Total coins earned by referred user that month
  bonus_paid_coins bigint NOT NULL, -- 5% bonus paid to recruiter (in paid coins)
  created_at timestamptz DEFAULT now(),
  UNIQUE (referred_user_id, month) -- Prevent double payout for same user/month
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_referral_bonus_recruiter_id ON referral_monthly_bonus(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_referral_bonus_referred_user_id ON referral_monthly_bonus(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_bonus_month ON referral_monthly_bonus(month);

-- Function to get total coins earned by a user in a specific month
-- This aggregates from gifts, battle gifts, and any other coin sources
CREATE OR REPLACE FUNCTION get_user_monthly_coins_earned(
  p_user_id uuid,
  p_month text -- Format: 'YYYY-MM'
)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_coins bigint := 0;
  v_year int;
  v_month int;
BEGIN
  -- Parse month string (e.g., '2025-02')
  v_year := CAST(SPLIT_PART(p_month, '-', 1) AS int);
  v_month := CAST(SPLIT_PART(p_month, '-', 2) AS int);
  
  -- Calculate total from gifts table (coins received)
  SELECT COALESCE(SUM(coins_spent), 0) INTO v_total_coins
  FROM gifts
  WHERE receiver_id = p_user_id
    AND EXTRACT(YEAR FROM created_at) = v_year
    AND EXTRACT(MONTH FROM created_at) = v_month;
  
  -- Add coins from battle gifts (if battle_gifts table exists)
  -- Note: Adjust based on your actual battle gifts table structure
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'troll_battle_gifts') THEN
    SELECT COALESCE(v_total_coins + SUM(coins_spent), v_total_coins) INTO v_total_coins
    FROM troll_battle_gifts
    WHERE receiver_id = p_user_id
      AND EXTRACT(YEAR FROM created_at) = v_year
      AND EXTRACT(MONTH FROM created_at) = v_month;
  END IF;
  
  -- Add any other coin sources (troll events, etc.)
  -- Extend this function as needed for other coin sources
  
  RETURN COALESCE(v_total_coins, 0);
END;
$$;

-- Ensure paid_coin_balance exists in user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' 
    AND column_name = 'paid_coin_balance'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN paid_coin_balance integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON TABLE referrals IS 'Tracks recruiter-referred user relationships for Troll Empire Partner Program';
COMMENT ON TABLE referral_monthly_bonus IS 'Tracks monthly bonus payouts to recruiters, prevents double payouts';
COMMENT ON FUNCTION get_user_monthly_coins_earned IS 'Calculates total coins earned by a user in a specific month from all sources';

