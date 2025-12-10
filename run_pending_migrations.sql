-- Run Pending Database Migrations
-- This script executes all pending migrations in the correct order

-- Migration 1: OG Badge System
\i 'supabase/migrations/20251126_add_og_badge.sql'

-- Migration 2: Revenue Settings
\i 'supabase/migrations/20251201_create_revenue_settings.sql'

-- Migration 3: Risk Tables
\i 'supabase/migrations/20251202_create_risk_tables.sql'

-- Migration 4: Broadcaster Earnings
\i 'supabase/migrations/20251203_create_broadcaster_earnings.sql'

-- Migration 5: Creator Applications Table
\i 'supabase/migrations/20251209_create_creator_applications.sql'

-- Migration 6: Creator Application RPC Functions
\i 'supabase/migrations/20251209_create_creator_application_rpcs.sql'

-- Migration 7: Add Recruiter ID to Profiles
\i 'supabase/migrations/20251209_add_recruiter_id_to_profiles.sql'

-- Verify migrations completed
SELECT 'All migrations completed successfully!' AS status;