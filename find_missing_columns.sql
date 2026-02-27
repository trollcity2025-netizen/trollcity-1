-- FIND MISSING COLUMNS - Run this in Supabase SQL Editor

-- Missing Columns in user_profiles
SELECT 'MISSING COLUMNS IN user_profiles' AS issue_type, 'user_profiles' AS table_name, column_name AS missing_column
FROM (VALUES
    ('id'),('username'),('email'),('avatar_url'),('role'),('troll_coins'),
    ('free_coin_balance'),('created_at'),('updated_at'),('is_admin'),('is_banned'),
    ('is_kicked'),('is_verified'),('is_broadcaster'),('is_troll_officer'),
    ('is_lead_officer'),('officer_rank'),('assigned_zip_count'),('is_officer_active'),
    ('glowing_username_color'),('rgb_username_expires_at'),('payout_paypal_email'),
    ('w9_status'),('is_pastor'),('live_restricted_until'),('last_known_ip'),
    ('ip_address_history'),('broadcast_chat_disabled'),('battle_wins'),('total_earned_coins'),
    ('seller_tier'),('owc_balance'),('total_owc_earned'),('is_landlord'),('on_duty')
) AS expected(column_name)
WHERE column_name NOT IN (SELECT column_name FROM information_schema.columns WHERE table_name = 'user_profiles' AND table_schema = 'public');

-- Missing Columns in streams
SELECT 'MISSING COLUMNS IN streams' AS issue_type, 'streams' AS table_name, column_name AS missing_column
FROM (VALUES
    ('id'),('title'),('broadcaster_id'),('status'),('is_live'),('viewer_count'),
    ('current_viewers'),('mux_playback_id'),('box_count'),('is_battle'),('battle_id'),
    ('has_rgb_effect'),('are_seats_locked'),('seat_price'),('active_theme_url'),
    ('total_gifts_coins'),('created_at')
) AS expected(column_name)
WHERE column_name NOT IN (SELECT column_name FROM information_schema.columns WHERE table_name = 'streams' AND table_schema = 'public');

-- Missing Columns in profiles
SELECT 'MISSING COLUMNS IN profiles' AS issue_type, 'profiles' AS table_name, column_name AS missing_column
FROM (VALUES
    ('id'),('username'),('email'),('avatar_url'),('cover_url'),('role'),
    ('is_admin'),('is_troll_officer'),('is_lead_officer'),('is_verified'),
    ('recruiter_id'),('created_at')
) AS expected(column_name)
WHERE column_name NOT IN (SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles' AND table_schema = 'public');
