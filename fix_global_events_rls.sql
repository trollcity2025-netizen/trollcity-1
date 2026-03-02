-- Fix RLS policies for global_events table
-- This migration adds proper RLS policies to allow authenticated users to create and read events

-- First, ensure RLS is enabled on the table
ALTER TABLE global_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS "Allow authenticated users to insert events" ON global_events;
DROP POLICY IF EXISTS "Allow users to read their own events" ON global_events;
DROP POLICY IF EXISTS "Allow users to read public events" ON global_events;
DROP POLICY IF EXISTS "Allow service role full access" ON global_events;

-- Policy 1: Allow authenticated users to insert events
-- This allows logged-in users to create event logs
CREATE POLICY "Allow authenticated users to insert events" 
ON global_events 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Policy 2: Allow authenticated users to read events they created
-- Users can see events where they are the actor
CREATE POLICY "Allow users to read their own events" 
ON global_events 
FOR SELECT 
TO authenticated 
USING (actor_id = auth.uid());

-- Policy 3: Allow authenticated users to read public events
-- Events with no specific actor or marked as public can be read by all authenticated users
CREATE POLICY "Allow users to read public events" 
ON global_events 
FOR SELECT 
TO authenticated 
USING (actor_id IS NULL OR is_public = true);

-- Policy 4: Allow service role full access
-- Service role can do everything (for edge functions, triggers, etc.)
CREATE POLICY "Allow service role full access" 
ON global_events 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Policy 5: Allow anon users to read public events (optional - remove if not needed)
-- If you want unauthenticated users to see certain events
CREATE POLICY "Allow anon users to read public events" 
ON global_events 
FOR SELECT 
TO anon 
USING (is_public = true);

-- Grant necessary permissions to authenticated role
GRANT INSERT, SELECT ON global_events TO authenticated;

-- Grant all permissions to service role
GRANT ALL ON global_events TO service_role;

-- If there's a sequence for the ID, grant usage on that too
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;
