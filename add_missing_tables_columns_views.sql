-- ============================================================================
-- MIGRATION: Add Missing Tables, Columns, and Views
-- ============================================================================
-- Run this in Supabase SQL Editor to add missing database objects

-- ============================================================================
-- PART 1: Add Missing Columns to user_profiles table (NOT profiles - profiles is a view)
-- ============================================================================
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_lead_officer BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS recruiter_id UUID REFERENCES user_profiles(id);

-- ============================================================================
-- PART 2: Create Missing Tables
-- ============================================================================

-- Table: user_event_dismissals
CREATE TABLE IF NOT EXISTS user_event_dismissals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    event_id UUID NOT NULL,
    dismissed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, event_id)
);

-- Table: emergency_alerts
CREATE TABLE IF NOT EXISTS emergency_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES user_profiles(id),
    alert_type TEXT NOT NULL,
    message TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- Table: gifts_catalog
CREATE TABLE IF NOT EXISTS gifts_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    icon_url TEXT,
    cost INTEGER DEFAULT 0,
    category TEXT,
    rarity TEXT,
    class TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: landlord_applications
CREATE TABLE IF NOT EXISTS landlord_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending',
    property_count INTEGER DEFAULT 0,
    experience TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES user_profiles(id)
);

-- Table: mai_judge_seats
CREATE TABLE IF NOT EXISTS mai_judge_seats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    user_id UUID REFERENCES user_profiles(id),
    seat_number INTEGER NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: marketplace_purchases
CREATE TABLE IF NOT EXISTS marketplace_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID REFERENCES user_profiles(id),
    item_id UUID REFERENCES marketplace_items(id),
    amount INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: rentals
CREATE TABLE IF NOT EXISTS rentals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id),
    tenant_id UUID REFERENCES user_profiles(id),
    start_date DATE NOT NULL,
    end_date DATE,
    monthly_rent INTEGER,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: role_bonuses
CREATE TABLE IF NOT EXISTS role_bonuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role TEXT NOT NULL UNIQUE,
    bonus_percentage INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: sellers_with_fraud_holds
CREATE TABLE IF NOT EXISTS sellers_with_fraud_holds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    fraud_hold_reason TEXT,
    fraud_hold_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: active_marketplace_disputes
CREATE TABLE IF NOT EXISTS active_marketplace_disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id UUID REFERENCES marketplace_purchases(id),
    buyer_id UUID REFERENCES user_profiles(id),
    seller_id UUID REFERENCES user_profiles(id),
    reason TEXT,
    status TEXT DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- ============================================================================
-- PART 3: Handle Missing Views (some may already be tables)
-- ============================================================================

-- broadcast_rankings already exists as a table - skip
-- (Table already exists in database)

-- creators_over_600 already exists as a table - skip

-- ledger_recent - create as view (use CASCADE to handle any existing object)
DROP VIEW IF EXISTS ledger_recent CASCADE;

CREATE VIEW ledger_recent AS
SELECT 
    ct.id,
    ct.user_id,
    up.username,
    ct.type,
    ct.amount,
    ct.coin_type,
    ct.description,
    ct.created_at
FROM coin_transactions ct
LEFT JOIN user_profiles up ON up.id = ct.user_id
ORDER BY ct.created_at DESC
LIMIT 100;

-- trollmers_weekly_leaderboard already exists as a table - skip

-- View: payout_dashboard
CREATE OR REPLACE VIEW payout_dashboard AS
SELECT 
    pr.id,
    pr.user_id,
    up.username,
    up.payout_paypal_email,
    pr.amount AS coins_requested,
    pr.cash_amount,
    pr.status,
    pr.created_at,
    pr.processed_at
FROM payout_requests pr
LEFT JOIN user_profiles up ON up.id = pr.user_id
ORDER BY pr.created_at DESC;

-- View: officer_quiz_results_view
DROP VIEW IF EXISTS officer_quiz_results_view;

CREATE OR REPLACE VIEW officer_quiz_results_view AS
SELECT 
    oqr.id,
    oqr.officer_id,
    up.username,
    oqr.created_at
FROM officer_quiz_results oqr
LEFT JOIN user_profiles up ON up.id = oqr.officer_id
ORDER BY oqr.created_at DESC;

-- ============================================================================
-- PART 4: Enable RLS on new tables
-- ============================================================================
ALTER TABLE user_event_dismissals ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE gifts_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE landlord_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE mai_judge_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_bonuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE sellers_with_fraud_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_marketplace_disputes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 5: Add basic policies (adjust as needed)
-- ============================================================================
-- Allow all read on catalog tables
CREATE POLICY "Allow read on gifts_catalog" ON gifts_catalog FOR SELECT USING (true);
CREATE POLICY "Allow read on role_bonuses" ON role_bonuses FOR SELECT USING (true);
CREATE POLICY "Allow read on marketplace_purchases" ON marketplace_purchases FOR SELECT USING (true);

-- Allow all read on views
CREATE POLICY "Allow read on broadcast_rankings" ON broadcast_rankings FOR SELECT USING (true);
CREATE POLICY "Allow read on creators_over_600" ON creators_over_600 FOR SELECT USING (true);
CREATE POLICY "Allow read on ledger_recent" ON ledger_recent FOR SELECT USING (true);
CREATE POLICY "Allow read on trollmers_weekly_leaderboard" ON trollmers_weekly_leaderboard FOR SELECT USING (true);
CREATE POLICY "Allow read on payout_dashboard" ON payout_dashboard FOR SELECT USING (true);
CREATE POLICY "Allow read on officer_quiz_results_view" ON officer_quiz_results_view FOR SELECT USING (true);

-- ============================================================================
-- Verification: Run these to confirm success
-- ============================================================================
-- SELECT 'Missing Tables Check:' AS status, COUNT(*) FROM (...) WHERE table_name NOT IN (SELECT table_name FROM information_schema.tables WHERE table_schema = 'public');
-- SELECT 'Missing Columns Check:' AS status, COUNT(*) FROM (...) WHERE column_name NOT IN (SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles');
-- SELECT 'Missing Views Check:' AS status, COUNT(*) FROM (...) WHERE view_name NOT IN (SELECT table_name FROM information_schema.views WHERE table_schema = 'public');
