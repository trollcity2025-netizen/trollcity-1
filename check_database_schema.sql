-- ============================================================================
-- COMPREHENSIVE DATABASE SCHEMA VERIFICATION SCRIPT
-- Checks for missing or duplicated tables, views, and functions
-- ============================================================================
-- Run this in Supabase SQL Editor to audit your database schema

-- ============================================================================
-- PART 1: CHECK FOR MISSING TABLES
-- ============================================================================
SELECT '=== MISSING TABLES ===' AS check_type;

WITH expected_tables AS (
    SELECT 'user_profiles' AS table_name UNION ALL
    SELECT 'user_balances' UNION ALL
    SELECT 'streams' UNION ALL
    SELECT 'stream_viewers' UNION ALL
    SELECT 'messages' UNION ALL
    SELECT 'troll_battles' UNION ALL
    SELECT 'broadcast_rankings' UNION ALL
    SELECT 'creators_over_600' UNION ALL
    SELECT 'trollmers_weekly_leaderboard' UNION ALL
    SELECT 'ledger_recent' UNION ALL
    SELECT 'payout_dashboard' UNION ALL
    SELECT 'user_event_dismissals' UNION ALL
    SELECT 'emergency_alerts' UNION ALL
    SELECT 'gifts_catalog' UNION ALL
    SELECT 'landlord_applications' UNION ALL
    SELECT 'mai_judge_seats' UNION ALL
    SELECT 'marketplace_purchases' UNION ALL
    SELECT 'rentals' UNION ALL
    SELECT 'role_bonuses' UNION ALL
    SELECT 'sellers_with_fraud_holds' UNION ALL
    SELECT 'active_marketplace_disputes' UNION ALL
    SELECT 'trollz_transactions' UNION ALL
    SELECT 'bonus_coin_transactions' UNION ALL
    SELECT 'troll_wheel_spins' UNION ALL
    SELECT 'stream_presets' UNION ALL
    SELECT 'stream_entries' UNION ALL
    SELECT 'user_reports' UNION ALL
    SELECT 'revenue_settings' UNION ALL
    SELECT 'user_risk_profile' UNION ALL
    SELECT 'risk_events' UNION ALL
    SELECT 'broadcaster_earnings' UNION ALL
    SELECT 'officer_actions' UNION ALL
    SELECT 'officer_earnings' UNION ALL
    SELECT 'wheel_spins' UNION ALL
    SELECT 'broadcast_officers' UNION ALL
    SELECT 'broadcast_lockdown' UNION ALL
    SELECT 'broadcaster_limits' UNION ALL
    SELECT 'test_stream_deletion_log' UNION ALL
    SELECT 'home_feature_cycles' UNION ALL
    SELECT 'home_feature_spend' UNION ALL
    SELECT 'daily_rewards' UNION ALL
    SELECT 'court_cases' UNION ALL
    SELECT 'court_sentences' UNION ALL
    SELECT 'court_verdicts' UNION ALL
    SELECT 'court_payments' UNION ALL
    SELECT 'entrance_effects' UNION ALL
    SELECT 'perks' UNION ALL
    SELECT 'insurance_options' UNION ALL
    SELECT 'onboarding_progress' UNION ALL
    SELECT 'onboarding_events' UNION ALL
    SELECT 'user_boosts' UNION ALL
    SELECT 'family_boosts' UNION ALL
    SELECT 'support_tickets' UNION ALL
    SELECT 'referrals' UNION ALL
    SELECT 'empire_partner_rewards' UNION ALL
    SELECT 'tromody_queue' UNION ALL
    SELECT 'tromody_matches' UNION ALL
    SELECT 'user_agreements' UNION ALL
    SELECT 'weekly_reports' UNION ALL
    SELECT 'user_purchases' UNION ALL
    SELECT 'user_active_items' UNION ALL
    SELECT 'user_avatar_customization' UNION ALL
    SELECT 'troll_mart_clothing' UNION ALL
    SELECT 'user_troll_mart_purchases' UNION ALL
    SELECT 'purchasable_items' UNION ALL
    SELECT 'purchase_ledger' UNION ALL
    SELECT 'cashout_requests' UNION ALL
    SELECT 'admin_broadcasts' UNION ALL
    SELECT 'user_entrance_effects' UNION ALL
    SELECT 'user_perks' UNION ALL
    SELECT 'user_insurances' UNION ALL
    SELECT 'landlord_loans' UNION ALL
    SELECT 'landlord_loan_payments' UNION ALL
    SELECT 'landlord_pay_admin' UNION ALL
    SELECT 'mai_talent_auditions' UNION ALL
    SELECT 'mai_talent_votes' UNION ALL
    SELECT 'mai_talent_judges' UNION ALL
    SELECT 'scheduled_announcements' UNION ALL
    SELECT 'notifications' UNION ALL
    SELECT 'system_roles' UNION ALL
    SELECT 'user_role_grants' UNION ALL
    SELECT 'audit_log' UNION ALL
    SELECT 'troll_drops' UNION ALL
    SELECT 'user_roles' UNION ALL
    SELECT 'user_cars' UNION ALL
    SELECT 'car_insurance_policies' UNION ALL
    SELECT 'property_insurance_policies' UNION ALL
    SELECT 'coin_orders' UNION ALL
    SELECT 'tournaments' UNION ALL
    SELECT 'tournament_participants' UNION ALL
    SELECT 'user_stats' UNION ALL
    SELECT 'xp_ledger' UNION ALL
    SELECT 'officer_live_assignments' UNION ALL
    SELECT 'officer_work_sessions' UNION ALL
    SELECT 'abuse_reports' UNION ALL
    SELECT 'properties' UNION ALL
    SELECT 'payout_requests' UNION ALL
    SELECT 'coin_transactions' UNION ALL
    SELECT 'officer_quiz_results' UNION ALL
    SELECT 'broadcaster_applications' UNION ALL
    SELECT 'profiles' 
)
SELECT 
    et.table_name,
    CASE 
        WHEN t.table_name IS NULL THEN 'MISSING'
        ELSE 'EXISTS'
    END AS status
FROM expected_tables et
LEFT JOIN information_schema.tables t 
    ON et.table_name = t.table_name 
    AND t.table_schema = 'public'
WHERE t.table_name IS NULL
ORDER BY et.table_name;

-- ============================================================================
-- PART 2: CHECK FOR DUPLICATED TABLES (same name in multiple schemas)
-- ============================================================================
SELECT '=== DUPLICATED TABLES (same name in different schemas) ===' AS check_type;

SELECT 
    table_name,
    table_schema,
    COUNT(*) AS count
FROM information_schema.tables
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
GROUP BY table_name, table_schema
HAVING COUNT(*) > 1;

-- ============================================================================
-- PART 3: CHECK FOR MISSING VIEWS
-- ============================================================================
SELECT '=== MISSING VIEWS ===' AS check_type;

WITH expected_views AS (
    SELECT 'ledger_recent' AS view_name UNION ALL
    SELECT 'payout_dashboard' UNION ALL
    SELECT 'officer_quiz_results_view' UNION ALL
    SELECT 'broadcast_rankings' UNION ALL
    SELECT 'creators_over_600' UNION ALL
    SELECT 'trollmers_weekly_leaderboard' UNION ALL
    SELECT 'user_3d_inventory' UNION ALL
    SELECT 'agreement_stats' UNION ALL
    SELECT 'view_secretary_revenue_stats' UNION ALL
    SELECT 'view_item_revenue_stats' UNION ALL
    SELECT 'earnings_view' UNION ALL
    SELECT 'monthly_earnings_breakdown' UNION ALL
    SELECT 'payout_history_view' UNION ALL
    SELECT 'irs_threshold_tracking' UNION ALL
    SELECT 'public_profiles' UNION ALL
    SELECT 'mai_talent_leaderboard'
)
SELECT 
    ev.view_name,
    CASE 
        WHEN v.table_name IS NULL THEN 'MISSING'
        ELSE 'EXISTS'
    END AS status
FROM expected_views ev
LEFT JOIN information_schema.views v 
    ON ev.view_name = v.table_name 
    AND v.table_schema = 'public'
WHERE v.table_name IS NULL
ORDER BY ev.view_name;

-- ============================================================================
-- PART 4: CHECK FOR DUPLICATED VIEWS
-- ============================================================================
SELECT '=== DUPLICATED VIEWS ===' AS check_type;

SELECT 
    table_name AS view_name,
    table_schema,
    COUNT(*) AS count
FROM information_schema.views
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
GROUP BY table_name, table_schema
HAVING COUNT(*) > 1;

-- ============================================================================
-- PART 5: CHECK FOR MISSING FUNCTIONS (Critical ones)
-- ============================================================================
SELECT '=== MISSING CRITICAL FUNCTIONS ===' AS check_type;

WITH expected_functions AS (
    SELECT 'add_trollz' AS function_name UNION ALL
    SELECT 'spend_trollz' UNION ALL
    SELECT 'add_bonus_coins' UNION ALL
    SELECT 'spend_bonus_coins' UNION ALL
    SELECT 'convert_trollz_to_coins' UNION ALL
    SELECT 'award_trollz_for_gift' UNION ALL
    SELECT 'spin_troll_wheel' UNION ALL
    SELECT 'get_trollz_balances' UNION ALL
    SELECT 'is_broadofficer' UNION ALL
    SELECT 'get_broadofficers' UNION ALL
    SELECT 'assign_broadofficer' UNION ALL
    SELECT 'remove_broadofficer' UNION ALL
    SELECT 'can_start_broadcast' UNION ALL
    SELECT 'grant_broadcaster_badge' UNION ALL
    SELECT 'revoke_broadcaster_badge' UNION ALL
    SELECT 'lock_broadcaster' UNION ALL
    SELECT 'update_viewer_count' UNION ALL
    SELECT 'get_active_viewer_count' UNION ALL
    SELECT 'update_broadcast_level' UNION ALL
    SELECT 'sync_broadcast_layout' UNION ALL
    SELECT 'start_battle' UNION ALL
    SELECT 'end_battle' UNION ALL
    SELECT 'end_stream_cleanup' UNION ALL
    SELECT 'spend_coins' UNION ALL
    SELECT 'get_user_id_by_username' UNION ALL
    SELECT 'get_user_3d_assets' UNION ALL
    SELECT 'find_tromody_match' UNION ALL
    SELECT 'get_gifter_leaderboard' UNION ALL
    SELECT 'get_top_war_families' UNION ALL
    SELECT 'get_or_create_active_cycle' UNION ALL
    SELECT 'record_home_feature_spend' UNION ALL
    SELECT 'end_home_feature_cycle' UNION ALL
    SELECT 'record_agreement_acceptance' UNION ALL
    SELECT 'has_accepted_agreement' UNION ALL
    SELECT 'update_updated_at_column' UNION ALL
    SELECT 'set_timestamp' UNION ALL
    SELECT 'is_admin' UNION ALL
    SELECT 'create_atomic_battle_challenge' UNION ALL
    SELECT 'purchase_vehicle' UNION ALL
    SELECT 'send_premium_gift' UNION ALL
    SELECT 'send_guest_gift' UNION ALL
    SELECT 'join_seat_atomic' UNION ALL
    SELECT 'purchase_rgb_broadcast' UNION ALL
    SELECT 'send_premium_gift_by_id' UNION ALL
    SELECT 'approve_broadcaster' UNION ALL
    SELECT 'reject_broadcaster_application' UNION ALL
    SELECT 'check_perk_expiry' UNION ALL
    SELECT 'check_insurance_expiry' UNION ALL
    SELECT 'end_battle_guarded' UNION ALL
    SELECT 'accept_battle' UNION ALL
    SELECT 'leave_battle' UNION ALL
    SELECT 'find_opponent' UNION ALL
    SELECT 'is_trollmers_eligible' UNION ALL
    SELECT 'summon_user_to_court' UNION ALL
    SELECT 'pay_landlord_loan' UNION ALL
    SELECT 'process_rent_with_loan_deduction' UNION ALL
    SELECT 'create_wall_post_reply' UNION ALL
    SELECT 'update_payment_logs_updated_at' UNION ALL
    SELECT 'update_platform_revenue_on_payment' UNION ALL
    SELECT 'buy_car_insurance' UNION ALL
    SELECT 'refill_gas' UNION ALL
    SELECT 'protect_owner_admin_changes' UNION ALL
    SELECT 'handle_user_signup' UNION ALL
    SELECT 'is_admin_user' UNION ALL
    SELECT 'get_user_gift_history' UNION ALL
    SELECT 'set_active_car' UNION ALL
    SELECT 'set_active_property' UNION ALL
    SELECT 'purchase_car_v2' UNION ALL
    SELECT 'add_troll_coins' UNION ALL
    SELECT 'add_free_coins' UNION ALL
    SELECT 'credit_coins' UNION ALL
    SELECT 'admin_grant_coins' UNION ALL
    SELECT 'get_auth_user_conversation_ids' UNION ALL
    SELECT 'process_gift_with_lucky' UNION ALL
    SELECT 'process_boosted_gift' UNION ALL
    SELECT 'troll_bank_credit_coins' UNION ALL
    SELECT 'troll_bank_spend_coins' UNION ALL
    SELECT 'troll_bank_apply_for_loan' UNION ALL
    SELECT 'apply_troll_pass_bundle' UNION ALL
    SELECT 'approve_manual_order' UNION ALL
    SELECT 'sync_ledger_to_transactions' UNION ALL
    SELECT 'send_gift_v2' UNION ALL
    SELECT 'set_password_reset_pin' UNION ALL
    SELECT 'process_referral_rewards' UNION ALL
    SELECT 'calculate_cashout_value' UNION ALL
    SELECT 'request_cashout_v2' UNION ALL
    SELECT 'approve_cashout_v2' UNION ALL
    SELECT 'join_stream_box' UNION ALL
    SELECT 'process_stream_billing' UNION ALL
    SELECT 'schedule_interview' UNION ALL
    SELECT 'complete_interview_and_hire' UNION ALL
    SELECT 'purchase_broadcast_theme' UNION ALL
    SELECT 'create_family_tasks' UNION ALL
    SELECT 'ensure_payout_not_locked' UNION ALL
    SELECT 'ensure_payout_window_open' UNION ALL
    SELECT 'pay_bank_loan' UNION ALL
    SELECT 'calculate_level' UNION ALL
    SELECT 'grant_xp' UNION ALL
    SELECT 'get_unread_notification_count' UNION ALL
    SELECT 'mark_all_notifications_read' UNION ALL
    SELECT 'create_notification' UNION ALL
    SELECT 'get_monthly_earnings' UNION ALL
    SELECT 'request_payout' UNION ALL
    SELECT 'current_user_id' UNION ALL
    SELECT 'is_authenticated' UNION ALL
    SELECT 'is_not_banned' UNION ALL
    SELECT 'is_not_suspended' UNION ALL
    SELECT 'has_role' UNION ALL
    SELECT 'is_staff' UNION ALL
    SELECT 'is_staff_on_duty' UNION ALL
    SELECT 'can_write' UNION ALL
    SELECT 'has_min_level' UNION ALL
    SELECT 'global_write_check' UNION ALL
    SELECT 'protect_profile_fields' UNION ALL
    SELECT 'is_staff' UNION ALL
    SELECT 'is_broadcast_owner' UNION ALL
    SELECT 'is_active_broadofficer' UNION ALL
    SELECT 'finalize_battle' UNION ALL
    SELECT 'register_battle_score' UNION ALL
    SELECT 'get_active_battle' UNION ALL
    SELECT 'get_credit_tier' UNION ALL
    SELECT 'clamp_credit_score' UNION ALL
    SELECT 'skip_opponent' UNION ALL
    SELECT 'cleanup_expired_user_purchases' UNION ALL
    SELECT 'get_current_court_session' UNION ALL
    SELECT 'get_admin_user_wallets' UNION ALL
    SELECT 'get_admin_user_wallets_secure' UNION ALL
    SELECT 'manual_clock_in' UNION ALL
    SELECT 'manual_clock_out' UNION ALL
    SELECT 'approve_creator_claim' UNION ALL
    SELECT 'reject_creator_claim' UNION ALL
    SELECT 'manual_start_break' UNION ALL
    SELECT 'manual_end_break' UNION ALL
    SELECT 'get_or_create_next_docket' UNION ALL
    SELECT 'troll_bank_pay_officer' UNION ALL
    SELECT 'sell_house_to_bank' UNION ALL
    SELECT 'get_bank_reserves' UNION ALL
    SELECT 'troll_bank_finalize_cashout' UNION ALL
    SELECT 'troll_bank_deny_cashout' UNION ALL
    SELECT 'troll_bank_escrow_coins' UNION ALL
    SELECT 'troll_bank_release_escrow' UNION ALL
    SELECT 'submit_cashout_request' UNION ALL
    SELECT 'cancel_cashout_request' UNION ALL
    SELECT 'admin_move_allocations' UNION ALL
    SELECT 'admin_update_setting' UNION ALL
    SELECT 'manage_court_case' UNION ALL
    SELECT 'manage_court_case_safe' UNION ALL
    SELECT 'check_daily_login' UNION ALL
    SELECT 'record_daily_login_post' UNION ALL
    SELECT 'add_owned_vehicle_to_profile' UNION ALL
    SELECT 'toggle_post_like' UNION ALL
    SELECT 'gift_post' UNION ALL
    SELECT 'vote_for_pitch' UNION ALL
    SELECT 'mark_conversation_read' UNION ALL
    SELECT 'mark_message_read' UNION ALL
    SELECT 'notify_payouts_open_if_needed' UNION ALL
    SELECT 'purchase_admin_for_week' UNION ALL
    SELECT 'apply_car_upgrade' UNION ALL
    SELECT 'sponsor_broadcast_item' UNION ALL
    SELECT 'boost_broadcast_level' UNION ALL
    SELECT 'decay_broadcast_levels' UNION ALL
    SELECT 'process_admin_queue' UNION ALL
    SELECT 'check_loan_defaults' UNION ALL
    SELECT 'buy_property_with_loan' UNION ALL
    SELECT 'pay_loan' UNION ALL
    SELECT 'sign_lease' UNION ALL
    SELECT 'pay_rent' UNION ALL
    SELECT 'purchase_landlord_license' UNION ALL
    SELECT 'get_property_occupancy' UNION ALL
    SELECT 'get_broadcast_level' UNION ALL
    SELECT 'toggle_cashout_hold' UNION ALL
    SELECT 'join_tournament' UNION ALL
    SELECT 'withdraw_tournament' UNION ALL
    SELECT 'submit_driver_test' UNION ALL
    SELECT 'refill_gas' UNION ALL
    SELECT 'consume_gas' UNION ALL
    SELECT 'purchase_insurance' UNION ALL
    SELECT 'request_gas' UNION ALL
    SELECT 'approve_gas_request' UNION ALL
    SELECT 'admin_suspend_license' UNION ALL
    SELECT 'sell_vehicle_to_dealership' UNION ALL
    SELECT 'increment_family_stats' UNION ALL
    SELECT 'track_family_event' UNION ALL
    SELECT 'donate_to_public_pool' UNION ALL
    SELECT 'foreclose_property' UNION ALL
    SELECT 'transfer_user_car' UNION ALL
    SELECT 'get_vehicle_details' UNION ALL
    SELECT 'sign_vehicle_title' UNION ALL
    SELECT 'request_vehicle_notarization' UNION ALL
    SELECT 'prepare_payout_run' UNION ALL
    SELECT 'refund_payout_run' UNION ALL
    SELECT 'set_user_role' UNION ALL
    SELECT 'admin_soft_delete_user' UNION ALL
    SELECT 'is_family_member_secure' UNION ALL
    SELECT 'is_family_leader_secure' UNION ALL
    SELECT 'update_car_value' UNION ALL
    SELECT 'trigger_update_car_value_on_upgrade' UNION ALL
    SELECT 'trigger_update_car_value_on_insert' UNION ALL
    SELECT 'approve_visa_redemption' UNION ALL
    SELECT 'fulfill_visa_redemption' UNION ALL
    SELECT 'reject_visa_redemption' UNION ALL
    SELECT 'fulfill_cashout_request' UNION ALL
    SELECT 'process_cashout_refund' UNION ALL
    SELECT 'approve_seller_application' UNION ALL
    SELECT 'resolve_support_ticket' UNION ALL
    SELECT 'delete_support_ticket' UNION ALL
    SELECT 'approve_officer_application' UNION ALL
    SELECT 'approve_lead_officer_application' UNION ALL
    SELECT 'deny_application' UNION ALL
    SELECT 'approve_application' UNION ALL
    SELECT 'update_prayer_likes_count' UNION ALL
    SELECT 'admin_end_shift' UNION ALL
    SELECT 'log_paypal_email_change' UNION ALL
    SELECT 'set_closed_at_if_closed' UNION ALL
    SELECT 'trigger_manual_backup' UNION ALL
    SELECT 'join_admin_queue' UNION ALL
    SELECT 'get_admin_queue' UNION ALL
    SELECT 'get_current_admin_week' UNION ALL
    SELECT 'rotate_admin_of_week' UNION ALL
    SELECT 'get_gift_stats'
)
SELECT 
    ef.function_name,
    CASE 
        WHEN p.proname IS NULL THEN 'MISSING'
        ELSE 'EXISTS'
    END AS status
FROM expected_functions ef
LEFT JOIN pg_proc p 
    ON ef.function_name = p.proname 
    AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
WHERE p.proname IS NULL
ORDER BY ef.function_name;

-- ============================================================================
-- PART 6: SUMMARY - Count of each object type
-- ============================================================================
SELECT '=== DATABASE OBJECT COUNTS ===' AS check_type;

SELECT 
    'Tables' AS object_type,
    COUNT(*) AS count
FROM information_schema.tables 
WHERE table_schema = 'public'
UNION ALL
SELECT 
    'Views' AS object_type,
    COUNT(*) AS count
FROM information_schema.views 
WHERE table_schema = 'public'
UNION ALL
SELECT 
    'Functions' AS object_type,
    COUNT(*) AS count
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public';

-- ============================================================================
-- PART 7: CHECK ledger_recent specifically (known issue)
-- ============================================================================
SELECT '=== LEDGER_RECENT STATUS ===' AS check_type;

SELECT 
    'ledger_recent' as object_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'ledger_recent') THEN 'VIEW'
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ledger_recent' AND table_type = 'BASE TABLE') THEN 'TABLE'
        WHEN EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'ledger_recent') THEN 'MATERIALIZED VIEW'
        ELSE 'NOT FOUND'
    END as object_type;

-- Test if ledger_recent works
SELECT 'ledger_recent SELECT test:' AS test, COUNT(*) as row_count 
FROM ledger_recent;
