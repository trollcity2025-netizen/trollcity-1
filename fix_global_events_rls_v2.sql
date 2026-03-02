-- Fix RLS policies for global_events table (Version 2 - Generic)
-- This migration adds basic RLS policies without assuming specific column names

-- First, ensure RLS is enabled on the table
ALTER TABLE global_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS "Allow authenticated users to insert events" ON global_events;
DROP POLICY IF EXISTS "Allow authenticated users to select events" ON global_events;
DROP POLICY IF EXISTS "Allow service role full access" ON global_events;
DROP POLICY IF EXISTS "Allow users to read their own events" ON global_events;
DROP POLICY IF EXISTS "Allow users to read public events" ON global_events;
DROP POLICY IF EXISTS "Allow anon users to read public events" ON global_events;

-- Policy 1: Allow authenticated users to insert events
-- This allows logged-in users to create event logs
CREATE POLICY "Allow authenticated users to insert events" 
ON global_events 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Policy 2: Allow authenticated users to read all events
-- If you want to restrict this, you'll need to know the column names
CREATE POLICY "Allow authenticated users to select events" 
ON global_events 
FOR SELECT 
TO authenticated 
USING (true);

-- Policy 3: Allow service role full access
-- Service role can do everything (for edge functions, triggers, etc.)
CREATE POLICY "Allow service role full access" 
ON global_events 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Grant necessary permissions to authenticated role
GRANT INSERT, SELECT ON global_events TO authenticated;

-- Grant all permissions to service role
GRANT ALL ON global_events TO service_role;

-- If there's a sequence for the ID, grant usage on that too
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;
