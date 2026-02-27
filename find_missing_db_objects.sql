-- ============================================================================
-- FIND MISSING TABLES
-- ============================================================================
SELECT 'MISSING TABLES' AS issue_type, table_name AS expected_table
FROM (VALUES
    ('user_profiles'),('profiles'),('streams'),('battles'),('admin_for_week_queue'),
    ('admin_settings'),('creator_applications'),('house_upgrades_catalog'),
    ('house_installations'),('user_tax_info'),('user_agreements'),('verification_requests'),
    ('applications'),('interviews'),('active_sessions'),('secretary_assignments'),
    ('badge_catalog'),('web_push_subscriptions'),('onesignal_tokens'),('payment_methods'),
    ('conversation_members'),('conversation_messages'),('stream_viewers'),('stream_bans'),
    ('notifications'),('stream_mutes'),('streams_participants'),('user_follows'),
    ('broadcast_background_themes'),('trollcity_shops'),('shop_items'),('gifts'),
    ('gift_items'),('purchasable_items'),('entrance_effects'),('broadcaster_stats'),
    ('user_perks'),('stream_messages'),('battle_participants'),('court_ai_feedback'),
    ('court_ai_messages'),('court_dockets'),('court_cases'),('court_session_state'),
    ('court_sessions'),('church_prayers'),('church_prayer_likes'),('user_badges'),
    ('church_passages'),('church_sermon_notes'),('car_upgrades'),('user_vehicle_upgrades'),
    ('creator_goal_boost'),('emergency_alerts'),('family_members'),('troll_families'),
    ('troll_family_members'),('troll_family_wars'),('gifts_catalog'),('officer_vote_cycles'),
    ('user_event_dismissals'),('global_events'),('user_call_sounds'),('call_history'),
    ('call_rooms'),('cashout_tiers'),('payout_requests'),('cashout_requests'),
    ('cars_catalog'),('signup_queue'),('critical_alerts'),('asset_auctions'),
    ('user_presence'),('troll_wall_posts'),('troll_wall_likes'),('pod_rooms'),
    ('rent_payment_log'),('broadcast_rankings'),('referrals'),('empire_partner_rewards'),
    ('wallets'),('empire_applications'),('visa_redemptions'),('earnings_view'),
    ('coin_transactions'),('monthly_earnings_breakdown'),('payout_history_view'),
    ('user_credit'),('credit_events'),('creator_migration_claims'),
    ('trollmers_tournament_participants'),('trollmers_weekly_leaderboard'),
    ('trollmers_tournament_battles'),('trollmers_weekly_payouts'),
    ('royal_family_leaderboard'),('admin_view_active_streams'),('stream_reports'),
    ('admin_actions_log'),('admin_tax_reviews'),('admin_app_settings'),('user_reputation'),
    ('officer_performance'),('seller_reliability'),('referral_monthly_bonus'),('payout_batches'),
    ('officer_payroll_logs'),('officer_corruption_flags'),('mobile_error_logs'),
    ('broadcaster_earnings'),('escalation_matrix'),('court_rulings_archive'),
    ('mai_talent_votes'),('mai_talent_queue'),('payout_dashboard'),('officer_shift_slots'),
    ('officer_work_sessions'),('troll_post_comments'),('troll_posts'),('troll_post_reactions'),
    ('weekly_officer_reports'),('weekly_reports'),('officer_rankings'),('zip_crime_dashboard'),
    ('task_seasons'),('task_templates'),('season_tasks'),('creators_over_600'),
    ('v_dealership_catalog'),('user_driver_licenses'),('family_stats'),('admin_broadcasts'),
    ('family_shop_items'),('family_shop_purchases'),('mai_talent_leaderboard'),('mai_show_sessions'),
    ('mai_stage_slots'),('mai_queue'),('mai_judge_seats'),('mai_talent_config'),
    ('mai_talent_judges'),('mai_talent_shows'),('troll_ai_avatars'),('family_seasons'),
    ('family_tasks'),('family_war_scores'),('houses_catalog'),('admin_pool'),('user_stats'),
    ('user_entrance_effects'),('user_insurances'),('call_minutes'),('properties'),('leases'),
    ('bank_loans'),('vehicle_listings'),('user_vehicles'),('vehicles_catalog'),
    ('user_inventory'),('marketplace_items'),('insurance_plans'),('insurance_options'),
    ('officer_actions'),('moderation_events'),('officer_payouts'),('owc_transactions'),
    ('neighbors_businesses'),('neighbors_participants'),('neighbors_events'),
    ('neighbors_hiring'),('shop_orders'),('trollcity_products'),('shop_transactions'),
    ('system_errors'),('system_alerts'),('system_settings'),('support_tickets'),
    ('scheduled_announcements'),('city_events'),('economy_summary'),('executive_reports'),
    ('payout_runs'),('payouts'),('system_roles'),('ledger_recent'),('appeal_actions'),
    ('active_marketplace_disputes'),('sellers_with_fraud_holds'),('marketplace_purchases'),
    ('stream_likes'),('tournaments'),('officer_quiz_results_view'),('officer_shifts'),
    ('officer_votes'),('perks'),('role_bonuses'),('broadcast_tokens'),
    ('stream_seat_sessions'),('rentals'),('interview_sessions'),('landlord_applications'),
    ('appeal_weekly_limits'),('transaction_appeals'),('call_sound_catalog')
) AS t(table_name)
WHERE table_name NOT IN (SELECT table_name FROM information_schema.tables WHERE table_schema = 'public')
ORDER BY table_name;

-- ============================================================================
-- FIND MISSING COLUMNS IN user_profiles
-- ============================================================================
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

-- ============================================================================
-- FIND MISSING COLUMNS IN streams
-- ============================================================================
SELECT 'MISSING COLUMNS IN streams' AS issue_type, 'streams' AS table_name, column_name AS missing_column
FROM (VALUES
    ('id'),('title'),('broadcaster_id'),('status'),('is_live'),('viewer_count'),
    ('current_viewers'),('mux_playback_id'),('box_count'),('is_battle'),('battle_id'),
    ('has_rgb_effect'),('are_seats_locked'),('seat_price'),('active_theme_url'),
    ('total_gifts_coins'),('created_at')
) AS expected(column_name)
WHERE column_name NOT IN (SELECT column_name FROM information_schema.columns WHERE table_name = 'streams' AND table_schema = 'public');

-- ============================================================================
-- FIND MISSING VIEWS
-- ============================================================================
SELECT 'MISSING VIEWS' AS issue_type, view_name AS expected_view
FROM (VALUES
    ('earnings_view'),('payout_history_view'),('monthly_earnings_breakdown'),
    ('admin_view_active_streams'),('trollmers_weekly_leaderboard'),
    ('royal_family_leaderboard'),('officer_rankings'),('zip_crime_dashboard'),
    ('broadcast_rankings'),('creators_over_600'),('v_dealership_catalog'),
    ('economy_summary'),('officer_quiz_results_view'),('ledger_recent'),
    ('payout_dashboard'),('view_admin_coin_revenue'),('view_admin_creator_tax_status'),
    ('view_secretary_revenue_stats')
) AS t(view_name)
WHERE view_name NOT IN (SELECT table_name FROM information_schema.views WHERE table_schema = 'public')
ORDER BY view_name;

-- ============================================================================
-- EXISTING TABLES (Reference)
-- ============================================================================
SELECT 'EXISTING TABLES' AS report_type, table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;

-- ============================================================================
-- EXISTING VIEWS (Reference)
-- ============================================================================
SELECT 'EXISTING VIEWS' AS report_type, table_name AS view_name FROM information_schema.views 
WHERE table_schema = 'public' ORDER BY table_name;
