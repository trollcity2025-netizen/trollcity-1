# Missing Migrations - Run These in Supabase

Based on the console errors, these migrations exist but **haven't been run in your Supabase database yet**.

## Required Migrations (Run in Order)

### 1. **Notifications System** ✅ File exists
**File:** `supabase/migrations/20251231_notifications_system.sql`

**Creates:**
- `notifications` table
- `get_unread_notification_count()` RPC function
- `mark_all_notifications_read()` RPC function
- `create_notification()` RPC function
- Database triggers for auto-notifications

**Error this fixes:**
- `404: rpc/get unread notification count`
- `400: notifications?select=id&user id=eq...`

---

### 2. **Earnings System** ✅ File exists
**File:** `supabase/migrations/20251231_earnings_system.sql`

**Creates:**
- `earnings_view` SQL view
- `monthly_earnings_breakdown` SQL view
- `payout_history_view` SQL view
- `irs_threshold_tracking` SQL view
- Ensures `payout_requests` table has correct columns

**Error this fixes:**
- `404: earnings_view`
- `404: monthly_earnings_breakdown`
- `404: payout_history_view`
- `404: irs_threshold_tracking`

---

### 3. **Monthly Earnings RPC** ✅ File exists
**File:** `supabase/migrations/20251231_get_monthly_earnings_rpc.sql`

**Creates:**
- `get_monthly_earnings(p_user_id)` RPC function

**Error this fixes:**
- `404: rpc/get_monthly_earnings`

---

### 4. **Request Payout RPC** ✅ File exists
**File:** `supabase/migrations/20251231_request_payout_rpc.sql`

**Creates:**
- `request_payout(p_user_id, p_coins_to_redeem)` RPC function

**Error this fixes:**
- Payout request functionality

---

### 5. **W9 Columns** ✅ File exists
**File:** `supabase/migrations/20251231_add_w9_columns.sql`

**Creates:**
- Adds W9/onboarding columns to `user_profiles`:
  - `legal_full_name`
  - `date_of_birth`
  - `country`
  - `address_line1`
  - `city`
  - `state_region`
  - `postal_code`
  - `tax_id_last4`
  - `tax_classification`
  - `w9_status`
  - `w9_verified_at`

**Error this fixes:**
- `Could not find the 'address_line1' column of 'user_profiles'`

---

### 6. **Scheduled Announcements** ✅ File exists
**File:** `supabase/migrations/20251130_scheduled_announcements.sql`

**Creates:**
- `scheduled_announcements` table

**Error this fixes:**
- `404: scheduled_announcements`

---

## How to Run Migrations

### Option 1: Supabase Dashboard (Recommended)
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **SQL Editor**
4. Copy and paste each migration file's contents
5. Click **Run** (or press `Ctrl+Enter`)
6. Repeat for each migration file

### Option 2: Supabase CLI
```bash
# Make sure you're in the project root
cd C:\Users\justk\Music\Trollcity2_chatgpt_edition_giftbox_admin_live_fix

# Link to your Supabase project (if not already linked)
npx supabase link --project-ref yjxpwfalenorzrqxwmtr

# Push all migrations
npx supabase db push
```

### Option 3: Run Individual Migrations
```bash
# Run specific migration
npx supabase migration up <migration_name>
```

---

## Migration Order (Important!)

Run migrations in this order:

1. ✅ `20251130_scheduled_announcements.sql` (if not already run)
2. ✅ `20251231_notifications_system.sql`
3. ✅ `20251231_add_w9_columns.sql`
4. ✅ `20251231_earnings_system.sql`
5. ✅ `20251231_get_monthly_earnings_rpc.sql`
6. ✅ `20251231_request_payout_rpc.sql`

---

## Verify Migrations Were Applied

After running migrations, check in Supabase SQL Editor:

```sql
-- Check if notifications table exists
SELECT * FROM notifications LIMIT 1;

-- Check if RPC function exists
SELECT proname FROM pg_proc WHERE proname = 'get_unread_notification_count';

-- Check if views exist
SELECT table_name FROM information_schema.views 
WHERE table_schema = 'public' 
AND table_name IN ('earnings_view', 'monthly_earnings_breakdown', 'payout_history_view', 'irs_threshold_tracking');

-- Check if W9 columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
AND column_name IN ('address_line1', 'w9_status', 'legal_full_name');
```

---

## Notes

- The frontend code has **fallback logic** to handle missing tables/views gracefully
- However, you should run these migrations to enable full functionality
- All migrations use `CREATE IF NOT EXISTS` or `CREATE OR REPLACE`, so they're safe to run multiple times
- If you get errors about existing objects, that's OK - the migration will update them

