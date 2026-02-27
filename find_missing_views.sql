-- FIND MISSING VIEWS - Run this in Supabase SQL Editor
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
