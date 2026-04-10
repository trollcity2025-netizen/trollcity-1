-- Emergency fix for X Ads - disable RLS temporarily for testing
-- Run this in Supabase SQL Editor

-- Disable RLS on all X Ads tables temporarily
ALTER TABLE ad_assets DISABLE ROW LEVEL SECURITY;
ALTER TABLE ad_videos DISABLE ROW LEVEL SECURITY;
ALTER TABLE ad_generation_jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE source_content_refs DISABLE ROW LEVEL SECURITY;

-- Check current data in ad_assets
SELECT id, asset_type, public_url, width, height, created_at 
FROM ad_assets 
ORDER BY created_at DESC 
LIMIT 10;

-- Check current data in ad_videos  
SELECT id, template_type, public_url, duration_seconds, created_at
FROM ad_videos
ORDER BY created_at DESC
LIMIT 10;

-- Check ad_generation_jobs status
SELECT id, job_type, job_status, error_message, created_at
FROM ad_generation_jobs
ORDER BY created_at DESC
LIMIT 10;

-- Check if ad-assets bucket exists
SELECT id, name, public FROM storage.buckets WHERE id = 'ad-assets';