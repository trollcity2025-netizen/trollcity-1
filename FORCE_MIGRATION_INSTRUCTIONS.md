# Force Migration Instructions

## ✅ New Migration File Created

I've created `force_apply_new_migration.sql` which contains ONLY the new migration with all `IF NOT EXISTS` checks. This file is safe to run multiple times.

## 🚀 How to Apply

### Option 1: Supabase Dashboard (Recommended - Fastest)
1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the entire contents of `force_apply_new_migration.sql`
5. Paste into the SQL Editor
6. Click **Run** (or press Ctrl+Enter)

This will apply all new tables, columns, functions, and indexes safely.

### Option 2: Using Supabase CLI (if you have direct DB access)
```bash
# If you have psql access
psql -h your-db-host -U postgres -d postgres -f force_apply_new_migration.sql
```

## 📋 What Gets Created

✅ **Tables:**
- `training_scenarios`
- `officer_training_sessions`
- `moderation_events`
- `observer_ratings`
- `shadow_bans`
- `ghost_presence_logs`
- `officer_mission_logs`
- `punishment_transactions`

✅ **Columns Added:**
- `user_profiles.officer_reputation_score`
- `user_profiles.is_ghost_mode`
- `officer_live_assignments.ghost_mode_active`

✅ **Functions:**
- `deduct_user_coins()`
- `detect_ghost_inactivity()`

✅ **Indexes:**
- All necessary indexes for performance

✅ **Seed Data:**
- 4 training scenarios

## ✅ All Safe
Every statement uses `IF NOT EXISTS` or `CREATE OR REPLACE`, so it's completely safe to run even if some objects already exist.

## 🎯 After Migration

1. Deploy Edge Functions (8 new functions)
2. Set up cron job for `ai-detect-ghost-inactivity`
3. Test the systems

The migration file is ready to run in Supabase Dashboard SQL Editor right now!

