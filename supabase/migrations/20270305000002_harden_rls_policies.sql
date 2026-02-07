-- Harden RLS Policies for 8 Identified Tables
-- Goal: Least Privilege, User-Owned Data Only, Service Role Protection

BEGIN;

-- ============================================================================
-- 1. gift_ledger
-- ============================================================================
ALTER TABLE public.gift_ledger ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users view own gifts" ON public.gift_ledger;
DROP POLICY IF EXISTS "Service Role Bypass" ON public.gift_ledger;

-- Create strict policies
CREATE POLICY "Users view own gifts" ON public.gift_ledger
    FOR SELECT USING (
        auth.role() = 'authenticated' AND 
        (auth.uid() = sender_id OR auth.uid() = receiver_id)
    );

-- Block all other access (Insert/Update/Delete managed by Service Role/RPCs)

-- ============================================================================
-- 2. broadcaster_stats
-- ============================================================================
ALTER TABLE public.broadcaster_stats ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Public view broadcaster stats" ON public.broadcaster_stats;
DROP POLICY IF EXISTS "Authenticated view broadcaster stats" ON public.broadcaster_stats;
DROP POLICY IF EXISTS "Service Role Bypass" ON public.broadcaster_stats;

-- Restrict base table to owner only
CREATE POLICY "Users view own stats" ON public.broadcaster_stats
    FOR SELECT USING (
        auth.role() = 'authenticated' AND 
        auth.uid() = user_id
    );

-- Create Public View for Leaderboards (Safe Fields Only)
DROP VIEW IF EXISTS public.broadcaster_stats_public;
CREATE VIEW public.broadcaster_stats_public AS
SELECT 
    user_id,
    total_gifts_24h,
    total_gifts_all_time,
    last_updated_at
FROM public.broadcaster_stats;

-- Grant access to view
GRANT SELECT ON public.broadcaster_stats_public TO authenticated;

-- ============================================================================
-- 3. battles
-- ============================================================================
ALTER TABLE public.battles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Public view battles" ON public.battles;
DROP POLICY IF EXISTS "Authenticated view battles" ON public.battles;
DROP POLICY IF EXISTS "Service Role Bypass" ON public.battles;
DROP POLICY IF EXISTS "Participants view own battles" ON public.battles;

-- Restrict base table to participants only (broadcasters of the streams)
-- Note: Requires joining to streams table to verify ownership
CREATE POLICY "Participants view own battles" ON public.battles
    FOR SELECT USING (
        auth.role() = 'authenticated' AND (
            EXISTS (
                SELECT 1 FROM public.streams s 
                WHERE s.id = battles.challenger_stream_id AND s.broadcaster_id = auth.uid()
            ) OR
            EXISTS (
                SELECT 1 FROM public.streams s 
                WHERE s.id = battles.opponent_stream_id AND s.broadcaster_id = auth.uid()
            )
        )
    );

-- Create Public View for Spectators
DROP VIEW IF EXISTS public.battles_public;
CREATE VIEW public.battles_public AS
SELECT 
    id AS battle_id,
    challenger_stream_id,
    opponent_stream_id,
    status,
    winner_stream_id,
    score_challenger,
    score_opponent,
    created_at,
    started_at,
    ended_at
FROM public.battles;

-- Grant access to view
GRANT SELECT ON public.battles_public TO authenticated;

-- ============================================================================
-- 4. districts
-- ============================================================================
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Public view districts" ON public.districts;
DROP POLICY IF EXISTS "Authenticated view districts" ON public.districts;

-- Catalog Table: Allow Authenticated Read (No Write)
CREATE POLICY "Authenticated view districts" ON public.districts
    FOR SELECT USING (
        auth.role() = 'authenticated'
    );

-- ============================================================================
-- 5. auction_bids
-- ============================================================================
ALTER TABLE public.auction_bids ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Public view auction bids" ON public.auction_bids;
DROP POLICY IF EXISTS "Authenticated view auction bids" ON public.auction_bids;
DROP POLICY IF EXISTS "Users insert own bids" ON public.auction_bids;
DROP POLICY IF EXISTS "Users view own bids" ON public.auction_bids;

-- Strict Owner Policies
CREATE POLICY "Users view own bids" ON public.auction_bids
    FOR SELECT USING (
        auth.role() = 'authenticated' AND 
        auth.uid() = bidder_user_id
    );

CREATE POLICY "Users insert own bids" ON public.auction_bids
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND 
        auth.uid() = bidder_user_id
    );

-- Create Public View for Auction History
DROP VIEW IF EXISTS public.auction_bids_public;
CREATE VIEW public.auction_bids_public AS
SELECT 
    id AS bid_id,
    auction_id,
    amount,
    created_at,
    bidder_user_id -- Publicly visible who bid
FROM public.auction_bids;

-- Grant access to view
GRANT SELECT ON public.auction_bids_public TO authenticated;

-- ============================================================================
-- 6. stream_seat_sessions
-- ============================================================================
ALTER TABLE public.stream_seat_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Public view stream seat sessions" ON public.stream_seat_sessions;
DROP POLICY IF EXISTS "Authenticated view stream seat sessions" ON public.stream_seat_sessions;
DROP POLICY IF EXISTS "Users view own seat session" ON public.stream_seat_sessions;

-- Restrict base table to seat holder only
CREATE POLICY "Users view own seat session" ON public.stream_seat_sessions
    FOR SELECT USING (
        auth.role() = 'authenticated' AND 
        auth.uid() = user_id
    );

-- Create Public View for "Who is on stage?"
DROP VIEW IF EXISTS public.stream_seat_sessions_public;
CREATE VIEW public.stream_seat_sessions_public AS
SELECT 
    stream_id,
    seat_index,
    user_id,
    joined_at
FROM public.stream_seat_sessions
WHERE status = 'active';

-- Grant access to view
GRANT SELECT ON public.stream_seat_sessions_public TO authenticated;

-- ============================================================================
-- 7. house_upgrades
-- ============================================================================
-- Assuming this is a Catalog table based on "house_upgrades_catalog" findings
-- If it's the legacy name for the catalog, treat as read-only catalog
ALTER TABLE public.house_upgrades ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Public view house upgrades" ON public.house_upgrades;
DROP POLICY IF EXISTS "Authenticated view house upgrades" ON public.house_upgrades;

-- Catalog: Allow Authenticated Read
CREATE POLICY "Authenticated view house upgrades" ON public.house_upgrades
    FOR SELECT USING (
        auth.role() = 'authenticated'
    );

-- ============================================================================
-- 8. user_house_upgrades
-- ============================================================================
-- Service Role Only - NO Policies for Authenticated/Anon
ALTER TABLE public.user_house_upgrades ENABLE ROW LEVEL SECURITY;

-- Drop any existing permissive policies
DROP POLICY IF EXISTS "Public view user house upgrades" ON public.user_house_upgrades;
DROP POLICY IF EXISTS "Authenticated view user house upgrades" ON public.user_house_upgrades;
DROP POLICY IF EXISTS "Users view own upgrades" ON public.user_house_upgrades;

-- Explicitly allow Service Role (Good practice to be explicit even if default is deny)
-- Note: Superusers/Service Role bypass RLS anyway, but this documents intent.
DROP POLICY IF EXISTS "Service Role Full Access" ON public.user_house_upgrades;
CREATE POLICY "Service Role Full Access" ON public.user_house_upgrades
    FOR ALL USING (auth.role() = 'service_role');


COMMIT;
