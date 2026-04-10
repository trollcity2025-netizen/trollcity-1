-- Fix RLS policies for X Ads tables
-- Run this in Supabase SQL Editor

-- Enable RLS if not already enabled
ALTER TABLE ad_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_content_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_publish_queue ENABLE ROW LEVEL SECURITY;

-- Drop existing policies that might be blocking access
DROP POLICY IF EXISTS "admins_full_access_assets" ON ad_assets;
DROP POLICY IF EXISTS "admins_full_access_videos" ON ad_videos;
DROP POLICY IF EXISTS "admins_full_access_jobs" ON ad_generation_jobs;
DROP POLICY IF EXISTS "admins_full_access_source_content" ON source_content_refs;
DROP POLICY IF EXISTS "admins_full_access_queue" ON social_publish_queue;
DROP POLICY IF EXISTS "secretaries_full_access_assets" ON ad_assets;
DROP POLICY IF EXISTS "secretaries_full_access_videos" ON ad_videos;
DROP POLICY IF EXISTS "secretaries_full_access_jobs" ON ad_generation_jobs;
DROP POLICY IF EXISTS "secretaries_full_access_source_content" ON source_content_refs;
DROP POLICY IF EXISTS "secretaries_full_access_queue" ON social_publish_queue;

-- Create permissive policies for authenticated users
CREATE POLICY "Authenticated users can read ad_assets" ON ad_assets
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read ad_videos" ON ad_videos
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read ad_generation_jobs" ON ad_generation_jobs
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read source_content_refs" ON source_content_refs
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read social_publish_queue" ON social_publish_queue
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert social_publish_queue" ON social_publish_queue
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update social_publish_queue" ON social_publish_queue
  FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete social_publish_queue" ON social_publish_queue
  FOR DELETE TO authenticated
  USING (true);

-- Also allow anon for testing
CREATE POLICY "Anon users can read ad_assets" ON ad_assets
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "Anon users can read ad_videos" ON ad_videos
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "Anon users can read ad_generation_jobs" ON ad_generation_jobs
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "Anon users can read source_content_refs" ON source_content_refs
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "Anon users can read social_publish_queue" ON social_publish_queue
  FOR SELECT TO anon
  USING (true);

-- Check current policies
SELECT tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('ad_assets', 'ad_videos', 'ad_generation_jobs', 'source_content_refs', 'social_publish_queue');