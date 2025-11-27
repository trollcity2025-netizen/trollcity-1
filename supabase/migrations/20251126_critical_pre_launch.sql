-- Critical Pre-Launch Migrations
-- Run this entire file in Supabase SQL Editor before launch

-- Drop existing tables if they exist (in reverse dependency order)
DROP TABLE IF EXISTS square_events CASCADE;
DROP TABLE IF EXISTS wheel_spins CASCADE;
DROP TABLE IF EXISTS officer_earnings CASCADE;
DROP TABLE IF EXISTS officer_actions CASCADE;
DROP TABLE IF EXISTS broadcaster_earnings CASCADE;
DROP TABLE IF EXISTS risk_events CASCADE;
DROP TABLE IF EXISTS user_risk_profile CASCADE;
DROP TABLE IF EXISTS revenue_settings CASCADE;

-- ============================================
-- 0. UPDATE COIN_TRANSACTIONS TABLE
-- ============================================
-- Add missing columns to coin_transactions for proper tracking
ALTER TABLE public.coin_transactions
  ADD COLUMN IF NOT EXISTS source_type TEXT,
  ADD COLUMN IF NOT EXISTS source_id TEXT,
  ADD COLUMN IF NOT EXISTS balance_after INTEGER;

-- Add index for source lookups
CREATE INDEX IF NOT EXISTS idx_coin_tx_source ON public.coin_transactions(source_type, source_id);

-- ============================================
-- 1. REVENUE SETTINGS TABLE
-- ============================================
CREATE TABLE revenue_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  platform_cut_pct INTEGER DEFAULT 40,
  broadcaster_cut_pct INTEGER DEFAULT 60,
  officer_cut_pct INTEGER DEFAULT 30,
  min_cashout_usd NUMERIC(10,2) DEFAULT 21,
  min_stream_hours_for_cashout NUMERIC(10,2) DEFAULT 5,
  cashout_hold_days INTEGER DEFAULT 0,
  tax_form_required BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default revenue settings
INSERT INTO revenue_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. RISK MANAGEMENT TABLES
-- ============================================
CREATE TABLE user_risk_profile (
  user_id UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
  risk_score INTEGER DEFAULT 0,
  is_frozen BOOLEAN DEFAULT false,
  freeze_reason TEXT,
  last_event_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE risk_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  severity INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for risk tables
CREATE INDEX IF NOT EXISTS idx_risk_profile_frozen ON user_risk_profile(is_frozen);
CREATE INDEX IF NOT EXISTS idx_risk_profile_score ON user_risk_profile(risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_risk_events_user ON risk_events(user_id);
CREATE INDEX IF NOT EXISTS idx_risk_events_created ON risk_events(created_at DESC);

-- ============================================
-- 3. BROADCASTER EARNINGS TABLE
-- ============================================
CREATE TABLE broadcaster_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcaster_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  gift_id UUID,
  coins_received INTEGER NOT NULL,
  usd_value NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for broadcaster earnings
CREATE INDEX IF NOT EXISTS idx_broadcaster_earnings_user ON broadcaster_earnings(broadcaster_id);
CREATE INDEX IF NOT EXISTS idx_broadcaster_earnings_created ON broadcaster_earnings(created_at DESC);

-- ============================================
-- 4. OFFICER ACTIONS & EARNINGS TABLES
-- ============================================
CREATE TABLE officer_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('kick', 'ban', 'mute', 'warning')),
  fee_coins INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE officer_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  action_id UUID REFERENCES officer_actions(id) ON DELETE CASCADE,
  commission_coins INTEGER NOT NULL,
  usd_value NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for officer tables
CREATE INDEX IF NOT EXISTS idx_officer_actions_officer ON officer_actions(officer_id);
CREATE INDEX IF NOT EXISTS idx_officer_actions_target ON officer_actions(target_user_id);
CREATE INDEX IF NOT EXISTS idx_officer_actions_created ON officer_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_officer_earnings_officer ON officer_earnings(officer_id);

-- ============================================
-- 5. WHEEL SPINS TABLE
-- ============================================
CREATE TABLE wheel_spins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  cost_coins INTEGER NOT NULL,
  outcome TEXT NOT NULL,
  prize_coins INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for wheel spins
CREATE INDEX IF NOT EXISTS idx_wheel_spins_user ON wheel_spins(user_id);
CREATE INDEX IF NOT EXISTS idx_wheel_spins_outcome ON wheel_spins(outcome);
CREATE INDEX IF NOT EXISTS idx_wheel_spins_created ON wheel_spins(created_at DESC);

-- ============================================
-- 6. SQUARE EVENTS TABLE (for webhook audit trail)
-- ============================================
CREATE TABLE square_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  data JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for square events
CREATE INDEX IF NOT EXISTS idx_square_events_event_id ON square_events(event_id);
CREATE INDEX IF NOT EXISTS idx_square_events_type ON square_events(type);
CREATE INDEX IF NOT EXISTS idx_square_events_created ON square_events(created_at DESC);

-- ============================================
-- 7. RLS POLICIES
-- ============================================

-- Square events (admin only)
ALTER TABLE square_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view square events"
ON square_events FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- Revenue settings (admin read only)
ALTER TABLE revenue_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read revenue settings"
ON revenue_settings FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- Risk profiles (admin only)
ALTER TABLE user_risk_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own risk profile"
ON user_risk_profile FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admin can view all risk profiles"
ON user_risk_profile FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- Broadcaster earnings (users view own, admin views all)
ALTER TABLE broadcaster_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own earnings"
ON broadcaster_earnings FOR SELECT
TO authenticated
USING (broadcaster_id = auth.uid());

CREATE POLICY "Admin can view all earnings"
ON broadcaster_earnings FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- Officer actions (officers view own, admin views all)
ALTER TABLE officer_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE officer_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Officers can view own actions"
ON officer_actions FOR SELECT
TO authenticated
USING (
  officer_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

CREATE POLICY "Officers can view own earnings"
ON officer_earnings FOR SELECT
TO authenticated
USING (
  officer_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- Wheel spins (users view own, admin views all)
ALTER TABLE wheel_spins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wheel spins"
ON wheel_spins FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admin can view all wheel spins"
ON wheel_spins FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- ============================================
-- 8. VERIFICATION QUERY
-- ============================================

-- Run this to verify all tables were created
SELECT 
  'revenue_settings' as table_name, 
  COUNT(*) as row_count 
FROM revenue_settings
UNION ALL
SELECT 'user_risk_profile', COUNT(*) FROM user_risk_profile
UNION ALL
SELECT 'risk_events', COUNT(*) FROM risk_events
UNION ALL
SELECT 'broadcaster_earnings', COUNT(*) FROM broadcaster_earnings
UNION ALL
SELECT 'officer_actions', COUNT(*) FROM officer_actions
UNION ALL
SELECT 'officer_earnings', COUNT(*) FROM officer_earnings
UNION ALL
SELECT 'wheel_spins', COUNT(*) FROM wheel_spins
UNION ALL
SELECT 'square_events', COUNT(*) FROM square_events;

-- Verify revenue settings are seeded
SELECT * FROM revenue_settings WHERE id = 1;
