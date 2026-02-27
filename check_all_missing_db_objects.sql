-- ============================================================================
-- COMPREHENSIVE DATABASE SCHEMA AUDIT
-- Checks ALL missing tables, views, functions, columns - comparing frontend needs vs database
-- ============================================================================
-- Run this in Supabase SQL Editor

-- ============================================================================
-- PART 1: ALL EXISTING TABLES (for reference)
-- ============================================================================
SELECT '=== ALL EXISTING TABLES ===' AS section;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE' 
ORDER BY table_name;

-- ============================================================================
-- PART 2: ALL EXISTING VIEWS (for reference)
-- ============================================================================
SELECT '=== ALL EXISTING VIEWS ===' AS section;
SELECT table_name AS view_name FROM information_schema.views 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- ============================================================================
-- PART 3: ALL EXISTING FUNCTIONS (for reference)
-- ============================================================================
SELECT '=== ALL EXISTING FUNCTIONS ===' AS section;
SELECT proname AS function_name, pg_get_function_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY proname;

-- ============================================================================
-- PART 4: MISSING TABLES (from all migration files)
-- ============================================================================
SELECT '=== MISSING TABLES ===' AS section;
SELECT table_name AS expected_table, 'TABLE' AS type
FROM (
    VALUES
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
    ('wallets'),('empire_applications'),('visa_redemptions'),
    ('coin_transactions'),
    ('user_credit'),('credit_events'),('creator_migration_claims'),
    ('trollmers_tournament_participants'),('trollmers_weekly_leaderboard'),
    ('trollmers_tournament_battles'),('trollmers_weekly_payouts'),
    ('royal_family_leaderboard'),('admin_view_active_streams'),('stream_reports'),
    ('admin_actions_log'),('admin_tax_reviews'),('admin_app_settings'),('user_reputation'),
    ('officer_performance'),('seller_reliability'),('referral_monthly_bonus'),('payout_batches'),
    ('officer_payroll_logs'),('officer_corruption_flags'),('mobile_error_logs'),
    ('broadcaster_earnings'),('escalation_matrix'),('court_rulings_archive'),
    ('mai_talent_votes'),('mai_talent_queue'),('officer_shift_slots'),
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
    ('payout_runs'),('payouts'),('system_roles'),('appeal_actions'),
    ('active_marketplace_disputes'),('sellers_with_fraud_holds'),('marketplace_purchases'),
    ('stream_likes'),('tournaments'),('officer_shifts'),
    ('officer_votes'),('perks'),('role_bonuses'),('broadcast_tokens'),
    ('stream_seat_sessions'),('rentals'),('interview_sessions'),('landlord_applications'),
    ('appeal_weekly_limits'),('transaction_appeals'),('call_sound_catalog'),
    ('user_balances'),('user_risk_profile'),('risk_events'),('officer_earnings'),
    ('wheel_spins'),('broadcast_officers'),('broadcast_lockdown'),('broadcaster_limits'),
    ('test_stream_deletion_log'),('home_feature_cycles'),('home_feature_spend'),('daily_rewards'),
    ('court_sentences'),('court_verdicts'),('court_payments'),('onboarding_progress'),
    ('onboarding_events'),('user_boosts'),('family_boosts'),('tromody_queue'),('tromody_matches'),
    ('user_agreements'),('user_purchases'),('user_active_items'),('user_avatar_customization'),
    ('troll_mart_clothing'),('user_troll_mart_purchases'),('purchase_ledger'),
    ('trollz_transactions'),('bonus_coin_transactions'),('troll_wheel_spins'),
    ('stream_presets'),('stream_entries'),('user_reports'),('revenue_settings'),
    ('landlord_loans'),('landlord_loan_payments'),('landlord_pay_admin'),
    ('mai_talent_auditions'),('troll_drops'),('user_roles'),('user_cars'),
    ('car_insurance_policies'),('property_insurance_policies'),('coin_orders'),
    ('tournament_participants'),('xp_ledger'),('officer_live_assignments'),('abuse_reports'),
    ('families'),('deeds'),('deed_transfers'),('loans'),('user_active_property'),
    ('user_active_car'),('manual_coin_orders'),('coin_packages'),('coin_ledger'),
    ('gift_ledger'),('admin_pool_ledger'),('user_vouchers'),('troll_wheel_prizes'),
    ('traffic_records'),('traffic_citations'),('vehicle_upgrades'),('user_houses'),
    ('pod_room_participants'),('pod_chat_messages'),('officer_chat_messages'),
    ('traffic_accidents'),('medical_records'),('medical_visits'),('hospital_bills'),
    ('bank_accounts'),('treasury_transactions'),('tax_withholdings')
) AS t(table_name)
WHERE table_name NOT IN (SELECT table_name FROM information_schema.tables WHERE table_schema = 'public')
ORDER BY table_name;

-- ============================================================================
-- PART 5: MISSING VIEWS
-- ============================================================================
SELECT '=== MISSING VIEWS ===' AS section;
SELECT view_name, 'VIEW' AS type
FROM (
    VALUES
    ('earnings_view'),('payout_history_view'),('monthly_earnings_breakdown'),
    ('admin_view_active_streams'),('trollmers_weekly_leaderboard'),
    ('royal_family_leaderboard'),('officer_rankings'),('zip_crime_dashboard'),
    ('broadcast_rankings'),('creators_over_600'),('v_dealership_catalog'),
    ('economy_summary'),('officer_quiz_results_view'),('ledger_recent'),
    ('payout_dashboard'),('view_admin_coin_revenue'),('view_admin_creator_tax_status'),
    ('view_secretary_revenue_stats'),('view_item_revenue_stats'),('user_3d_inventory'),
    ('agreement_stats'),('irs_threshold_tracking'),('public_profiles'),
    ('officer_quiz_results_view')
) AS t(view_name)
WHERE view_name NOT IN (SELECT table_name FROM information_schema.views WHERE table_schema = 'public')
ORDER BY view_name;

-- ============================================================================
-- PART 6: MISSING FUNCTIONS (Critical Frontend RPCs)
-- ============================================================================
SELECT '=== MISSING FUNCTIONS ===' AS section;
SELECT function_name, 'FUNCTION' AS type
FROM (
    VALUES
    ('troll_bank_credit_coins'),('troll_bank_spend_coins'),('spend_coins'),('credit_coins'),
    ('add_troll_coins'),('add_free_coins'),('admin_grant_coins'),('add_bonus_coins'),
    ('spend_bonus_coins'),('convert_trollz_to_coins'),('add_trollz'),('spend_trollz'),
    ('get_trollz_balances'),('spin_troll_wheel'),('award_trollz_for_gift'),
    ('send_gift_v2'),('send_premium_gift'),('send_premium_gift_by_id'),('send_guest_gift'),
    ('process_gift_with_lucky'),('process_boosted_gift'),
    ('request_cashout_v2'),('approve_cashout_v2'),('submit_cashout_request'),('cancel_cashout_request'),
    ('calculate_cashout_value'),('troll_bank_finalize_cashout'),('troll_bank_deny_cashout'),
    ('troll_bank_escrow_coins'),('troll_bank_release_escrow'),
    ('buy_car_insurance'),('buy_property_insurance'),('purchase_insurance'),
    ('set_active_car'),('set_active_property'),('purchase_car_v2'),('purchase_vehicle'),
    ('is_admin'),('is_staff'),('is_broadcast_owner'),('is_active_broadofficer'),
    ('handle_user_signup'),('current_user_id'),('is_authenticated'),('is_not_banned'),
    ('is_not_suspended'),('has_role'),('has_min_level'),('can_write'),('global_write_check'),
    ('is_admin_user'),('protect_profile_fields'),('protect_owner_admin_changes'),
    ('get_user_gift_history'),('get_user_id_by_username'),
    ('get_unread_notification_count'),('mark_all_notifications_read'),('create_notification'),
    ('get_monthly_earnings'),('request_payout'),('approve_manual_order'),
    ('apply_troll_pass_bundle'),('troll_bank_apply_for_loan'),('pay_bank_loan'),
    ('buy_property_with_loan'),('pay_loan'),('sign_lease'),('pay_rent'),
    ('purchase_landlord_license'),('get_property_occupancy'),
    ('sell_house_to_bank'),('get_bank_reserves'),('donate_to_public_pool'),('foreclose_property'),
    ('grant_xp'),('calculate_level'),('calculate_level_details'),
    ('get_broadcast_level'),('boost_broadcast_level'),('sponsor_broadcast_item'),
    ('start_battle'),('end_battle'),('accept_battle'),('leave_battle'),('find_opponent'),
    ('register_battle_score'),('get_active_battle'),('finalize_battle'),('skip_opponent'),
    ('can_start_broadcast'),('grant_broadcaster_badge'),('revoke_broadcaster_badge'),
    ('lock_broadcaster'),('update_viewer_count'),('get_active_viewer_count'),
    ('update_broadcast_level'),('sync_broadcast_layout'),('end_stream_cleanup'),
    ('join_stream_box'),('process_stream_billing'),('decay_broadcast_levels'),
    ('is_broadofficer'),('get_broadofficers'),('assign_broadofficer'),('remove_broadofficer'),
    ('manual_clock_in'),('manual_clock_out'),('manual_start_break'),('manual_end_break'),
    ('approve_application'),('deny_application'),('approve_officer_application'),
    ('approve_lead_officer_application'),('approve_seller_application'),
    ('approve_creator_claim'),('reject_creator_claim'),
    ('schedule_interview'),('complete_interview_and_hire'),
    ('get_current_court_session'),('summon_user_to_court'),('manage_court_case'),
    ('manage_court_case_safe'),('get_or_create_next_docket'),
    ('get_gifter_leaderboard'),('get_top_war_families'),
    ('get_or_create_active_cycle'),('record_home_feature_spend'),('end_home_feature_cycle'),
    ('record_agreement_acceptance'),('has_accepted_agreement'),
    ('get_user_3d_assets'),('find_tromody_match'),
    ('check_perk_expiry'),('check_insurance_expiry'),
    ('refill_gas'),('consume_gas'),('request_gas'),('approve_gas_request'),
    ('admin_suspend_license'),('submit_driver_test'),
    ('toggle_post_like'),('gift_post'),('vote_for_pitch'),
    ('mark_conversation_read'),('mark_message_read'),
    ('notify_payouts_open_if_needed'),('prepare_payout_run'),('refund_payout_run'),
    ('purchase_admin_for_week'),('join_admin_queue'),('get_admin_queue'),
    ('get_current_admin_week'),('rotate_admin_of_week'),
    ('set_user_role'),('admin_soft_delete_user'),
    ('is_family_member_secure'),('is_family_leader_secure'),
    ('update_car_value'),('trigger_update_car_value_on_upgrade'),('trigger_update_car_value_on_insert'),
    ('approve_visa_redemption'),('fulfill_visa_redemption'),('reject_visa_redemption'),
    ('fulfill_cashout_request'),('process_cashout_refund'),
    ('resolve_support_ticket'),('delete_support_ticket'),
    ('update_prayer_likes_count'),('admin_end_shift'),
    ('log_paypal_email_change'),('set_closed_at_if_closed'),
    ('trigger_manual_backup'),('get_gift_stats'),
    ('track_family_event'),('increment_family_stats'),
    ('transfer_user_car'),('get_vehicle_details'),('sign_vehicle_title'),
    ('request_vehicle_notarization'),('sell_vehicle_to_dealership'),
    ('create_atomic_battle_challenge'),('join_seat_atomic'),('purchase_rgb_broadcast'),
    ('get_credit_tier'),('clamp_credit_score'),('cleanup_expired_user_purchases'),
    ('check_loan_defaults'),('process_admin_queue'),('admin_move_allocations'),
    ('admin_update_setting'),('troll_bank_pay_officer'),
    ('pay_landlord_loan'),('process_rent_with_loan_deduction'),
    ('create_wall_post_reply'),('update_payment_logs_updated_at'),
    ('update_platform_revenue_on_payment'),('update_updated_at_column'),
    ('set_timestamp'),('record_daily_login_post'),('check_daily_login'),
    ('add_owned_vehicle_to_profile'),('apply_car_upgrade'),
    ('toggle_cashout_hold'),('join_tournament'),('withdraw_tournament')
) AS t(function_name)
WHERE function_name NOT IN (
    SELECT proname FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
)
ORDER BY function_name;

-- ============================================================================
-- PART 7: MISSING COLUMNS IN KEY TABLES
-- ============================================================================
SELECT '=== MISSING COLUMNS IN user_profiles ===' AS section;
SELECT column_name AS missing_column, 'user_profiles' AS table_name
FROM (
    VALUES
    ('id'),('username'),('email'),('avatar_url'),('role'),('troll_coins'),
    ('free_coin_balance'),('paid_coin_balance'),('earned_coin_balance'),('total_earned_coins'),
    ('total_spent_coins'),('created_at'),('updated_at'),('is_admin'),('is_banned'),
    ('is_kicked'),('is_verified'),('is_broadcaster'),('is_troll_officer'),
    ('is_lead_officer'),('officer_rank'),('officer_level'),('assigned_zip_count'),('is_officer_active'),
    ('glowing_username_color'),('rgb_username_expires_at'),('payout_paypal_email'),
    ('w9_status'),('is_pastor'),('live_restricted_until'),('last_known_ip'),
    ('ip_address_history'),('broadcast_chat_disabled'),('battle_wins'),
    ('seller_tier'),('owc_balance'),('total_owc_earned'),('is_landlord'),('on_duty'),
    ('clocked_in'),('clocked_in_at'),('credit_score'),('banned_at'),('suspended_until'),
    ('staff_override_until'),('admin_override_until'),('marketplace_approved'),
    ('trollmonds'),('total_trollmonds'),('vip_expires_at'),('vip_tier'),
    ('full_name'),('phone'),('gender'),('cover_url'),('is_test_user'),
    ('og_badge'),('recruiter_id'),('onboarding_completed'),('terms_accepted'),
    ('payout_locked'),('payout_locked_reason')
) AS t(column_name)
WHERE column_name NOT IN (
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND table_schema = 'public'
);

SELECT '=== MISSING COLUMNS IN streams ===' AS section;
SELECT column_name AS missing_column, 'streams' AS table_name
FROM (
    VALUES
    ('id'),('title'),('broadcaster_id'),('status'),('is_live'),('viewer_count'),
    ('current_viewers'),('mux_playback_id'),('box_count'),('is_battle'),('battle_id'),
    ('has_rgb_effect'),('are_seats_locked'),('seat_price'),('active_theme_url'),
    ('total_gifts_coins'),('created_at'),('thumbnail_url'),('description'),
    ('last_level_update_at'),('broadcast_level'),('broadcast_level_percent'),('last_gift_at')
) AS t(column_name)
WHERE column_name NOT IN (
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'streams' AND table_schema = 'public'
);

SELECT '=== MISSING COLUMNS IN properties ===' AS section;
SELECT column_name AS missing_column, 'properties' AS table_name
FROM (
    VALUES
    ('id'),('owner_id'),('name'),('address'),('price'),('is_for_sale'),
    ('bedrooms'),('bathrooms'),('sqft'),('tenant_capacity'),('current_tenants'),
    ('amenities'),('image_url'),('is_active_home'),('model_url'),('description'),
    ('is_admin_created'),('is_landlord_purchased'),('is_leased'),('lease_id')
) AS t(column_name)
WHERE column_name NOT IN (
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'properties' AND table_schema = 'public'
);

SELECT '=== MISSING COLUMNS IN payout_requests ===' AS section;
SELECT column_name AS missing_column, 'payout_requests' AS table_name
FROM (
    VALUES
    ('id'),('user_id'),('amount'),('status'),('created_at'),('processed_at'),
    ('cash_amount'),('coins_redeemed'),('admin_id'),('notes'),('escrowed_coins')
) AS t(column_name)
WHERE column_name NOT IN (
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'payout_requests' AND table_schema = 'public'
);

SELECT '=== MISSING COLUMNS IN coin_transactions ===' AS section;
SELECT column_name AS missing_column, 'coin_transactions' AS table_name
FROM (
    VALUES
    ('id'),('user_id'),('type'),('amount'),('coin_type'),('description'),
    ('created_at'),('fee'),('balance_after'),('metadata'),('direction'),('reason')
) AS t(column_name)
WHERE column_name NOT IN (
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'coin_transactions' AND table_schema = 'public'
);

-- ============================================================================
-- PART 8: COUNTS SUMMARY
-- ============================================================================
SELECT '=== DATABASE OBJECT COUNTS ===' AS section;
SELECT 'Tables' AS object_type, COUNT(*) AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
UNION ALL
SELECT 'Views' AS object_type, COUNT(*) FROM information_schema.views WHERE table_schema = 'public'
UNION ALL
SELECT 'Functions' AS object_type, COUNT(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public';

-- ============================================================================
-- PART 9: TEST CRITICAL TABLES ARE ACCESSIBLE
-- ============================================================================
SELECT '=== TESTING CRITICAL TABLE ACCESS ===' AS section;

-- Test user_profiles
SELECT 'user_profiles rows:' AS test, COUNT(*) AS count FROM user_profiles;

-- Test streams  
SELECT 'streams rows:' AS test, COUNT(*) AS count FROM streams;

-- Test coin_transactions
SELECT 'coin_transactions rows:' AS test, COUNT(*) AS count FROM coin_transactions;

-- Test properties
SELECT 'properties rows:' AS test, COUNT(*) AS count FROM properties;

-- Test payout_requests
SELECT 'payout_requests rows:' AS test, COUNT(*) AS count FROM payout_requests;

-- Test ledger_recent view
SELECT 'ledger_recent rows:' AS test, COUNT(*) AS count FROM ledger_recent;

-- Test earnings_view
SELECT 'earnings_view test:' AS test, COUNT(*) AS count FROM earnings_view;

-- Test payout_dashboard
SELECT 'payout_dashboard rows:' AS test, COUNT(*) AS count FROM payout_dashboard;
