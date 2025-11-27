# Apply Database Migration

## Option 1: Using Supabase Dashboard (RECOMMENDED)

1. Go to https://supabase.com/dashboard/project/yjxpwfalenorzrqxwmtr
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query"
4. Copy the entire contents of `supabase/migrations/20251125_fix_user_signup_trigger.sql`
5. Paste it into the SQL editor
6. Click "Run" button
7. Check for success message

## Option 2: Test if it worked

After applying the migration:

1. Try creating a new user account through your signup form
2. Check the Supabase Dashboard -> Authentication -> Users to see if the user was created
3. Check the Database -> Tables -> user_profiles to verify the profile was created with all fields
4. Check your app's home page to see if the new user appears in "New Trollerz"

## Troubleshooting

If you see errors:
- Check the Supabase Logs (Database -> Logs)
- Look for any WARNING messages related to the trigger functions
- Verify the triggers exist: Database -> Triggers

The migration has improved error handling so even if there are issues, user creation should not fail completely.
