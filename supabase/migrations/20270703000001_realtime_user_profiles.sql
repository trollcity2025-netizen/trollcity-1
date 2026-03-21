-- Ensure REPLICA IDENTITY is set for realtime to work on user_profiles
-- This is needed for postgres_changes to work correctly

-- Set REPLICA IDENTITY to DEFAULT (uses primary key)
ALTER TABLE public.user_profiles REPLICA IDENTITY DEFAULT;

-- Enable realtime for user_profiles table
-- This ensures Supabase can broadcast changes to connected clients
