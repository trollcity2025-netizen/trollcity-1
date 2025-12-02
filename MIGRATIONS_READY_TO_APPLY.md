# Migrations Ready to Apply

## ✅ New Migrations Created

1. **20250104_officer_live_assignments.sql** - Officer stream tracking table
2. **20250104_officer_work_sessions_and_abuse_reports.sql** - Work sessions, abuse reports, and RPC functions

## 🚀 How to Apply

### Option 1: Supabase Dashboard (Recommended)
1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `apply_new_migrations.sql` (already created with IF NOT EXISTS checks)
4. Click "Run"

### Option 2: Via Supabase CLI (if local instance running)
```bash
npx supabase migration up
```

### Option 3: Direct SQL Execution
The file `apply_new_migrations.sql` contains all the new migrations with proper IF NOT EXISTS checks, so it's safe to run multiple times.

## 📋 What Gets Created

### Tables:
- `officer_live_assignments` - Tracks active officer stream assignments
- `officer_work_sessions` - Tracks work shifts for payroll
- `abuse_reports` - Reports submitted by officers

### Columns Added:
- `user_profiles.officer_level` - Officer level (1-3) for pay rate calculation
- `officer_live_assignments.last_activity` - Last activity timestamp
- `officer_live_assignments.auto_clocked_out` - Auto-clockout flag

### Functions:
- `approve_officer_application(app_id UUID)` - RPC to approve officer applications

### Indexes:
- All necessary indexes for performance

## ✅ All Safe to Run
All migrations use `IF NOT EXISTS` and `CREATE OR REPLACE`, so they're safe to run even if some objects already exist.

## 📝 Next Steps After Migration

1. Deploy Edge Functions:
   ```bash
   npx supabase functions deploy officer-join-stream
   npx supabase functions deploy officer-leave-stream
   npx supabase functions deploy officer-auto-clockout
   npx supabase functions deploy officer-report-abuse
   npx supabase functions deploy officer-touch-activity
   npx supabase functions deploy officer-get-assignment
   ```

2. Set up Cron Job for auto-clockout:
   - Go to Supabase Dashboard → Database → Cron Jobs
   - Create a new cron job that calls `officer-auto-clockout` every 10 minutes
   - Pattern: `*/10 * * * *`

3. Test the system:
   - Have an officer join a stream
   - Check `/admin/officers-live` to see tracking
   - Test auto-clockout after 15 minutes of inactivity

