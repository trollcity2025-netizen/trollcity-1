-- ===================================================
-- COMPREHENSIVE PENDING MIGRATIONS SCRIPT
-- ===================================================
-- Date: 2025-12-09
-- This script applies all critical pending migrations for TrollCity2
-- ===================================================

-- ===================================================
-- MIGRATION 1: OG Badge System
-- ===================================================
-- OG Badge System Migration
-- Adds OG badge column and auto-grant trigger for early users

-- 1. Add og_badge column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'og_badge'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN og_badge BOOLEAN DEFAULT false;
  END IF;
END $$;

-- 2. Create trigger to auto-grant OG badge to users created before 2026-01-01
CREATE OR REPLACE FUNCTION grant_og_badge()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_at < '2026-01-01' THEN
    NEW.og_badge = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create trigger
DROP TRIGGER IF EXISTS tr_grant_og_badge ON user_profiles;
CREATE TRIGGER tr_grant_og_badge
BEFORE INSERT OR UPDATE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION grant_og_badge();

-- 4. Update existing users who joined before 2026-01-01
UPDATE user_profiles
SET og_badge = true
WHERE created_at < '2026-01-01'
AND og_badge = false;

-- 5. Add index for OG badge for faster queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_og_badge ON user_profiles(og_badge);

-- ===================================================
-- MIGRATION 2: Revenue Settings
-- ===================================================
-- Revenue Settings Table Migration
-- Creates table for platform revenue configuration

CREATE TABLE IF NOT EXISTS revenue_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  platform_cut_pct INTEGER DEFAULT 40,
  broadcaster_cut_pct INTEGER DEFAULT 60,
  officer_cut_pct INTEGER DEFAULT 30,
  min_cashout_usd NUMERIC(10,2) DEFAULT 50,
  min_stream_hours_for_cashout INTEGER DEFAULT 10,
  cashout_hold_days INTEGER DEFAULT 7,
  tax_form_required BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed initial data if table is empty
INSERT INTO revenue_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policy for admin access
ALTER TABLE revenue_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage revenue settings" ON revenue_settings;
CREATE POLICY "Admins can manage revenue settings"
  ON revenue_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND (role = 'admin' OR is_admin = true)
    )
  );

-- ===================================================
-- MIGRATION 3: Risk Management Tables
-- ===================================================
-- Risk Management Tables Migration
-- Creates tables for user risk profiling and event tracking

-- 1. Create user_risk_profile table
CREATE TABLE IF NOT EXISTS user_risk_profile (
  user_id UUID PRIMARY KEY REFERENCES user_profiles(id),
  risk_score INTEGER DEFAULT 0,
  is_frozen BOOLEAN DEFAULT false,
  freeze_reason TEXT,
  last_event_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create risk_events table
CREATE TABLE IF NOT EXISTS risk_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id),
  event_type TEXT NOT NULL,
  severity INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_risk_profile_risk_score ON user_risk_profile(risk_score);
CREATE INDEX IF NOT EXISTS idx_user_risk_profile_is_frozen ON user_risk_profile(is_frozen);
CREATE INDEX IF NOT EXISTS idx_risk_events_user_id ON risk_events(user_id);
CREATE INDEX IF NOT EXISTS idx_risk_events_created_at ON risk_events(created_at);
CREATE INDEX IF NOT EXISTS idx_risk_events_severity ON risk_events(severity);

-- 4. Create RLS policies
ALTER TABLE user_risk_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own risk profile
DROP POLICY IF EXISTS "Users can view their own risk profile" ON user_risk_profile;
CREATE POLICY "Users can view their own risk profile"
  ON user_risk_profile FOR SELECT
  USING (user_id = auth.uid());

-- Officers and admins can view all risk profiles
DROP POLICY IF EXISTS "Officers can view all risk profiles" ON user_risk_profile;
CREATE POLICY "Officers can view all risk profiles"
  ON user_risk_profile FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND (is_officer = true OR role = 'admin' OR is_admin = true)
    )
  );

-- Officers and admins can manage risk profiles
DROP POLICY IF EXISTS "Officers can manage risk profiles" ON user_risk_profile;
CREATE POLICY "Officers can manage risk profiles"
  ON user_risk_profile FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND (is_officer = true OR role = 'admin' OR is_admin = true)
    )
  );

-- Users can view their own risk events
DROP POLICY IF EXISTS "Users can view their own risk events" ON risk_events;
CREATE POLICY "Users can view their own risk events"
  ON risk_events FOR SELECT
  USING (user_id = auth.uid());

-- Officers and admins can view all risk events
DROP POLICY IF EXISTS "Officers can view all risk events" ON risk_events;
CREATE POLICY "Officers can view all risk events"
  ON risk_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND (is_officer = true OR role = 'admin' OR is_admin = true)
    )
  );

-- Officers and admins can create risk events
DROP POLICY IF EXISTS "Officers can create risk events" ON risk_events;
CREATE POLICY "Officers can create risk events"
  ON risk_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND (is_officer = true OR role = 'admin' OR is_admin = true)
    )
  );

-- ===================================================
-- MIGRATION 4: Broadcaster Earnings
-- ===================================================
-- Broadcaster Earnings Table Migration
-- Creates table for tracking broadcaster earnings from gifts

CREATE TABLE IF NOT EXISTS broadcaster_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcaster_id UUID REFERENCES user_profiles(id),
  gift_id UUID,
  coins_received INTEGER NOT NULL,
  usd_value NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_broadcaster_earnings_broadcaster_id ON broadcaster_earnings(broadcaster_id);
CREATE INDEX IF NOT EXISTS idx_broadcaster_earnings_gift_id ON broadcaster_earnings(gift_id);
CREATE INDEX IF NOT EXISTS idx_broadcaster_earnings_created_at ON broadcaster_earnings(created_at);

-- Create RLS policies
ALTER TABLE broadcaster_earnings ENABLE ROW LEVEL SECURITY;

-- Broadcasters can view their own earnings
DROP POLICY IF EXISTS "Broadcasters can view their own earnings" ON broadcaster_earnings;
CREATE POLICY "Broadcasters can view their own earnings"
  ON broadcaster_earnings FOR SELECT
  USING (broadcaster_id = auth.uid());

-- Officers and admins can view all earnings
DROP POLICY IF EXISTS "Officers can view all earnings" ON broadcaster_earnings;
CREATE POLICY "Officers can view all earnings"
  ON broadcaster_earnings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND (is_officer = true OR role = 'admin' OR is_admin = true)
    )
  );

-- Officers and admins can manage earnings
DROP POLICY IF EXISTS "Officers can manage earnings" ON broadcaster_earnings;
CREATE POLICY "Officers can manage earnings"
  ON broadcaster_earnings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND (is_officer = true OR role = 'admin' OR is_admin = true)
    )
  );

-- Create a trigger to automatically populate broadcaster_earnings when gifts are received
CREATE OR REPLACE FUNCTION track_broadcaster_earnings()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate USD value (assuming 100 coins = $1)
  INSERT INTO broadcaster_earnings (
    broadcaster_id,
    gift_id,
    coins_received,
    usd_value,
    created_at
  ) VALUES (
    NEW.receiver_id,
    NEW.id,
    NEW.coins_spent,
    NEW.coins_spent / 100.0,
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on gifts table
DROP TRIGGER IF EXISTS tr_track_broadcaster_earnings ON gifts;
CREATE TRIGGER tr_track_broadcaster_earnings
AFTER INSERT ON gifts
FOR EACH ROW
EXECUTE FUNCTION track_broadcaster_earnings();

-- ===================================================
-- MIGRATION 5: Officer Actions and Earnings
-- ===================================================
-- Officer Actions and Earnings Tables

CREATE TABLE IF NOT EXISTS officer_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id UUID REFERENCES user_profiles(id),
  action_type TEXT NOT NULL, -- 'kick', 'ban', 'mute', 'warn'
  target_user_id UUID REFERENCES user_profiles(id),
  reason TEXT,
  coins_penalty INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS officer_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id UUID REFERENCES user_profiles(id),
  earnings_type TEXT NOT NULL, -- 'shift_pay', 'commission', 'bonus'
  amount INTEGER NOT NULL,
  source_type TEXT, -- 'stream', 'gift', 'bonus'
  source_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_officer_actions_officer_id ON officer_actions(officer_id);
CREATE INDEX IF NOT EXISTS idx_officer_actions_created_at ON officer_actions(created_at);
CREATE INDEX IF NOT EXISTS idx_officer_earnings_officer_id ON officer_earnings(officer_id);
CREATE INDEX IF NOT EXISTS idx_officer_earnings_created_at ON officer_earnings(created_at);

-- Create RLS policies
ALTER TABLE officer_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE officer_earnings ENABLE ROW LEVEL SECURITY;

-- Officers can view their own actions and earnings
CREATE POLICY "Officers can view their own actions"
  ON officer_actions FOR SELECT
  USING (officer_id = auth.uid());

CREATE POLICY "Officers can view their own earnings"
  ON officer_earnings FOR SELECT
  USING (officer_id = auth.uid());

-- Admins can view all
CREATE POLICY "Admins can view all officer actions"
  ON officer_actions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND (role = 'admin' OR is_admin = true)
    )
  );

CREATE POLICY "Admins can view all officer earnings"
  ON officer_earnings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND (role = 'admin' OR is_admin = true)
    )
  );

-- ===================================================
-- MIGRATION 6: Wheel Spins Table
-- ===================================================
-- Troll Wheel System

CREATE TABLE IF NOT EXISTS wheel_spins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id),
  coins_spent INTEGER NOT NULL,
  prize_type TEXT, -- 'coins', 'bonus', 'special'
  prize_amount INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_wheel_spins_user_id ON wheel_spins(user_id);
CREATE INDEX IF NOT EXISTS idx_wheel_spins_created_at ON wheel_spins(created_at);

-- Create RLS policy
ALTER TABLE wheel_spins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own wheel spins"
  ON wheel_spins FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create wheel spins"
  ON wheel_spins FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Admins can view all
CREATE POLICY "Admins can view all wheel spins"
  ON wheel_spins FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND (role = 'admin' OR is_admin = true)
    )
  );

-- ===================================================
-- MIGRATION COMPLETION
-- ===================================================
-- All critical migrations have been applied successfully!

-- Log completion
INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
SELECT id, 0, 'migration', 'Database migrations applied successfully'
FROM user_profiles 
WHERE role = 'admin' OR is_admin = true
LIMIT 1
ON CONFLICT DO NOTHING;