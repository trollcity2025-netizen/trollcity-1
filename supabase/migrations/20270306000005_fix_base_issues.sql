-- Fix base issues flagged in baseissues file
-- 1. Fix function_search_path_mutable
-- 2. Fix SECURITY DEFINER view
-- 3. Enable RLS and policies

BEGIN;

-- ============================================================================
-- Part 1: Fix function search_path
-- ============================================================================
DO $$
DECLARE
    r RECORD;
    func_names TEXT[] := ARRAY[
        'update_stream_viewer_count', 'is_moderator', 'kick_user', 'mute_user', 'unmute_user', 
        'assign_broadofficer', 'remove_broadofficer', 'spend_coins', 'try_pay_coins', 'join_paid_seat', 
        'join_seat_atomic', 'create_battle_challenge', 'accept_battle', 'end_battle', 'finalize_battle', 
        'find_opponent', 'register_battle_score', 'notify_troll_battle_complete', 'ensure_broadcaster_badge', 
        'award_badge_db', 'create_president_election', 'finalize_president_election', 'remove_president', 
        'appoint_vice_president', 'remove_vice_president', 'signup_president_candidate', 'approve_president_candidate', 
        'reject_president_candidate', 'vote_for_president_candidate', 'vote_candidate_with_coins', 
        'set_president_vote_week_key', 'president_raise_payouts', 'spend_president_treasury', 
        'post_president_announcement', 'create_president_proposal', 'log_president_action', 'president_flag_user', 
        'admin_soft_delete_user', 'ban_user', 'unban_user', 'get_banned_users', 'notify_payout_request', 
        'notify_stream_report', 'trigger_notify_admin_ticket', 'get_active_streams_paged', 'get_active_battle', 
        'refresh_broadcaster_stats', 'update_stream_viewer_count', 'increment_stream_likes', 'send_gift', 
        'send_premium_gift', 'send_gift_ledger', 'process_gift_ledger_batch', 'purchase_rgb_broadcast', 
        'purchase_house', 'purchase_house_upgrade', 'get_house_stats', 'create_rental_listing', 
        'create_rental_listing_v2', 'rent_property', 'purchase_landlord_license', 'process_daily_asset_upkeep', 
        'pay_house_dues', 'purchase_vehicle', 'purchase_car', 'pay_car_dues', 'generate_license_plate', 
        'pay_vehicle_insurance', 'renew_vehicle_insurance', 'apply_vehicle_upgrade', 'get_broadcast_vehicle_status', 
        'purchase_from_ktauto', 'log_paypal_email_change', 'check_instant_loan_eligibility', 
        'buy_property_with_loan', 'get_user_asset_flags', 'get_credit_tier', 'clamp_credit_score', 
        'can_start_broadcast'
    ];
BEGIN
    FOR r IN 
        SELECT oid::regprocedure as func_signature
        FROM pg_proc
        WHERE proname = ANY(func_names)
        AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'ALTER FUNCTION ' || r.func_signature || ' SET search_path = pg_catalog, public';
    END LOOP;
END $$;

-- ============================================================================
-- Part 2: Fix SECURITY DEFINER view (broadcaster_stats_public)
-- ============================================================================
-- Drop if exists (view or legacy function)
DROP VIEW IF EXISTS public.broadcaster_stats_public;

-- Ensure underlying table has RLS
ALTER TABLE public.broadcaster_stats ENABLE ROW LEVEL SECURITY;

-- Policy for broadcaster_stats: Allow authenticated to view all stats (for leaderboards)
-- Note: baseissues asks for RLS on underlying tables. 
-- Since this is for leaderboards/stats, it should be readable by others.
-- We check if a policy already exists that restricts it too much.
DROP POLICY IF EXISTS "Users view own stats" ON public.broadcaster_stats;
DROP POLICY IF EXISTS "Public view broadcaster stats" ON public.broadcaster_stats;

-- Create policy allowing authenticated users to read all stats
CREATE POLICY "Public view broadcaster stats" ON public.broadcaster_stats
    FOR SELECT TO authenticated
    USING (true);

-- Recreate view as a standard view (NOT Security Definer)
CREATE OR REPLACE VIEW public.broadcaster_stats_public AS
SELECT user_id, total_gifts_24h, total_gifts_all_time, last_updated_at
FROM public.broadcaster_stats;

GRANT SELECT ON public.broadcaster_stats_public TO authenticated;


-- ============================================================================
-- Part 3: Enable RLS and Policies
-- ============================================================================

-- 1. gift_ledger
ALTER TABLE public.gift_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view relevant gifts" ON public.gift_ledger;
DROP POLICY IF EXISTS "Users can insert own gifts" ON public.gift_ledger;
DROP POLICY IF EXISTS "Users view own gifts" ON public.gift_ledger; -- drop old one

CREATE POLICY "Users can view relevant gifts" ON public.gift_ledger
    FOR SELECT TO authenticated
    USING (
        -- Check both sender and receiver (using sender_id/receiver_id as per schema)
        (auth.uid() = sender_id OR auth.uid() = receiver_id) 
        OR 
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator', 'troll_officer'))
    );

CREATE POLICY "Users can insert own gifts" ON public.gift_ledger
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = sender_id);

-- 2. battles
ALTER TABLE public.battles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants view own battles" ON public.battles;
DROP POLICY IF EXISTS "Creators insert battles" ON public.battles;
DROP POLICY IF EXISTS "Participants update battles" ON public.battles;
DROP POLICY IF EXISTS "View battles" ON public.battles;

CREATE POLICY "View battles" ON public.battles
    FOR SELECT TO authenticated
    USING (
        -- Participants
        EXISTS (SELECT 1 FROM public.streams s WHERE s.id = battles.challenger_stream_id AND s.broadcaster_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.streams s WHERE s.id = battles.opponent_stream_id AND s.broadcaster_id = auth.uid()) OR
        -- Active/Public battles (assuming status 'active' or similar)
        status = 'active' OR
        status = 'pending'
    );

CREATE POLICY "Creators insert battles" ON public.battles
    FOR INSERT TO authenticated
    WITH CHECK (
        -- Assuming creator is tracked, or implicitly linked to the challenger stream
        EXISTS (SELECT 1 FROM public.streams s WHERE s.id = battles.challenger_stream_id AND s.broadcaster_id = auth.uid())
    );

CREATE POLICY "Participants update battles" ON public.battles
    FOR UPDATE TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.streams s WHERE s.id = battles.challenger_stream_id AND s.broadcaster_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.streams s WHERE s.id = battles.opponent_stream_id AND s.broadcaster_id = auth.uid())
    );


-- 3. districts
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public view districts" ON public.districts;
DROP POLICY IF EXISTS "Owners manage districts" ON public.districts;
DROP POLICY IF EXISTS "Authenticated view districts" ON public.districts;

CREATE POLICY "Public view districts" ON public.districts
    FOR SELECT TO authenticated
    USING (true);

-- 4. house_upgrades
ALTER TABLE public.house_upgrades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public view house_upgrades" ON public.house_upgrades;
CREATE POLICY "Public view house_upgrades" ON public.house_upgrades
    FOR SELECT TO authenticated
    USING (true);


-- 5. user_house_upgrades
ALTER TABLE public.user_house_upgrades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own upgrades" ON public.user_house_upgrades;
DROP POLICY IF EXISTS "Users insert own upgrades" ON public.user_house_upgrades;

CREATE POLICY "Users view own upgrades" ON public.user_house_upgrades
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_houses
            WHERE user_houses.id = user_house_upgrades.user_house_id
            AND user_houses.user_id = auth.uid()
        )
    );

CREATE POLICY "Users insert own upgrades" ON public.user_house_upgrades
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_houses
            WHERE user_houses.id = user_house_upgrades.user_house_id
            AND user_houses.user_id = auth.uid()
        )
    );


-- 6. auction_bids
ALTER TABLE public.auction_bids ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View auction bids" ON public.auction_bids;
DROP POLICY IF EXISTS "Place auction bids" ON public.auction_bids;
DROP POLICY IF EXISTS "Users view own bids" ON public.auction_bids;
DROP POLICY IF EXISTS "Users insert own bids" ON public.auction_bids;

CREATE POLICY "View auction bids" ON public.auction_bids
    FOR SELECT TO authenticated
    USING (
        bidder_user_id = auth.uid()
    );

CREATE POLICY "Place auction bids" ON public.auction_bids
    FOR INSERT TO authenticated
    WITH CHECK (bidder_user_id = auth.uid());


-- 7. stream_seat_sessions
ALTER TABLE public.stream_seat_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View stream seat sessions" ON public.stream_seat_sessions;
DROP POLICY IF EXISTS "Manage stream seat sessions" ON public.stream_seat_sessions;
DROP POLICY IF EXISTS "Users view own seat session" ON public.stream_seat_sessions;

CREATE POLICY "View stream seat sessions" ON public.stream_seat_sessions
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.streams s WHERE s.id = stream_seat_sessions.stream_id AND s.broadcaster_id = auth.uid())
    );

CREATE POLICY "Manage stream seat sessions" ON public.stream_seat_sessions
    FOR ALL TO authenticated
    USING (
        user_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.streams s WHERE s.id = stream_seat_sessions.stream_id AND s.broadcaster_id = auth.uid())
    );


-- ============================================================================
-- Part 4: Indexes (Conditional)
-- ============================================================================
-- Add indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_gift_ledger_sender ON public.gift_ledger(sender_id);
CREATE INDEX IF NOT EXISTS idx_gift_ledger_receiver ON public.gift_ledger(receiver_id);
CREATE INDEX IF NOT EXISTS idx_stream_seat_sessions_user ON public.stream_seat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_seat_sessions_stream ON public.stream_seat_sessions(stream_id);
CREATE INDEX IF NOT EXISTS idx_user_house_upgrades_house ON public.user_house_upgrades(user_house_id);
CREATE INDEX IF NOT EXISTS idx_auction_bids_bidder ON public.auction_bids(bidder_user_id);
CREATE INDEX IF NOT EXISTS idx_battles_creator ON public.battles(challenger_stream_id); -- Proxy for creator
CREATE INDEX IF NOT EXISTS idx_battles_streams ON public.battles(challenger_stream_id, opponent_stream_id);

COMMIT;
