-- Troll City X Ads Generator + Share Studio Database Schema
-- Phase 1-8 Implementation

-- ============================================
-- PHASE 7: ANALYTICS TABLES
-- ============================================

-- Connected Social Accounts (X and Instagram OAuth)
CREATE TABLE IF NOT EXISTS connected_social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('x', 'instagram')),
  platform_user_id VARCHAR(255) NOT NULL,
  platform_username VARCHAR(255),
  platform_display_name VARCHAR(255),
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  account_status VARCHAR(20) DEFAULT 'active' CHECK (account_status IN ('active', 'disconnected', 'expired', 'error')),
  last_synced_at TIMESTAMPTZ,
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, platform)
);

-- Source Content References (Troll City content sources)
CREATE TABLE IF NOT EXISTS source_content_refs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type VARCHAR(50) NOT NULL,
  content_id VARCHAR(255),
  title VARCHAR(500),
  description TEXT,
  url TEXT,
  screenshot_url TEXT,
  thumbnail_url TEXT,
  stats JSONB DEFAULT '{}',
  cta_text VARCHAR(255),
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Ad Generation Jobs
CREATE TABLE IF NOT EXISTS ad_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_content_id UUID REFERENCES source_content_refs(id),
  job_type VARCHAR(50) NOT NULL CHECK (job_type IN ('image_ad', 'video_promo', 'caption_only', 'full_campaign')),
  job_status VARCHAR(20) DEFAULT 'pending' CHECK (job_status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  template_type VARCHAR(50),
  requested_by UUID REFERENCES auth.users(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ad Assets (Generated images and graphics)
CREATE TABLE IF NOT EXISTS ad_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES ad_generation_jobs(id),
  asset_type VARCHAR(30) NOT NULL CHECK (asset_type IN ('square_post', 'portrait_story', 'landscape_promo', 'fallback_graphic')),
  file_path TEXT,
  public_url TEXT,
  width INTEGER,
  height INTEGER,
  file_size INTEGER,
  format VARCHAR(20),
  metadata JSONB DEFAULT '{}',
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ad Videos (Generated 30-second promos)
CREATE TABLE IF NOT EXISTS ad_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES ad_generation_jobs(id),
  template_type VARCHAR(50) CHECK (template_type IN ('feature_promo', 'live_now_promo', 'event_promo', 'government_promo', 'careers_promo', 'wallet_promo', '3_scene', 'slideshow', 'feature_reveal', 'vertical_reel')),
  file_path TEXT,
  public_url TEXT,
  duration_seconds INTEGER,
  width INTEGER,
  height INTEGER,
  file_size INTEGER,
  format VARCHAR(20),
  metadata JSONB DEFAULT '{}',
  has_audio BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Caption Variants (Generated caption options)
CREATE TABLE IF NOT EXISTS caption_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES ad_generation_jobs(id),
  caption_style VARCHAR(30) NOT NULL CHECK (caption_style IN ('aggressive', 'clean', 'hype', 'founder', 'short_promo')),
  caption_text TEXT NOT NULL,
  hashtags TEXT,
  mentions TEXT,
  cta_text VARCHAR(255),
  cta_url TEXT,
  is_selected BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Social Publish Queue
CREATE TABLE IF NOT EXISTS social_publish_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID,
  video_id UUID,
  caption_id UUID REFERENCES caption_variants(id),
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('x', 'instagram')),
  account_id UUID REFERENCES connected_social_accounts(id),
  publish_status VARCHAR(20) DEFAULT 'draft' CHECK (publish_status IN ('draft', 'scheduled', 'publishing', 'published', 'failed', 'archived')),
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  platform_post_id TEXT,
  platform_post_url TEXT,
  utm_params JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Social Publish Logs
CREATE TABLE IF NOT EXISTS social_publish_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID REFERENCES social_publish_queue(id),
  platform VARCHAR(20),
  action VARCHAR(50),
  request_payload JSONB,
  response_data JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ad Analytics
CREATE TABLE IF NOT EXISTS ad_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_content_id UUID REFERENCES source_content_refs(id),
  asset_id UUID REFERENCES ad_assets(id),
  video_id UUID REFERENCES ad_videos(id),
  caption_id UUID REFERENCES caption_variants(id),
  queue_id UUID REFERENCES social_publish_queue(id),
  platform VARCHAR(20),
  source_type VARCHAR(50),
  asset_type VARCHAR(50),
  caption_version VARCHAR(30),
  publish_timestamp TIMESTAMPTZ,
  clicks_count INTEGER DEFAULT 0,
  impressions_count INTEGER DEFAULT 0,
  engagement_count INTEGER DEFAULT 0,
  utm_source VARCHAR(50),
  utm_medium VARCHAR(50),
  utm_campaign VARCHAR(100),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE connected_social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_content_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE caption_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_publish_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_publish_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_analytics ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "admins_full_access_connected_accounts" ON connected_social_accounts
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

CREATE POLICY "admins_full_access_source_content" ON source_content_refs
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

CREATE POLICY "admins_full_access_jobs" ON ad_generation_jobs
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

CREATE POLICY "admins_full_access_assets" ON ad_assets
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

CREATE POLICY "admins_full_access_videos" ON ad_videos
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

CREATE POLICY "admins_full_access_captions" ON caption_variants
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

CREATE POLICY "admins_full_access_queue" ON social_publish_queue
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

CREATE POLICY "admins_full_access_logs" ON social_publish_logs
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

CREATE POLICY "admins_full_access_analytics" ON ad_analytics
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

-- Secretaries get full access too
CREATE POLICY "secretaries_full_access_connected_accounts" ON connected_social_accounts
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE role = 'secretary'));

CREATE POLICY "secretaries_full_access_source_content" ON source_content_refs
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE role = 'secretary'));

CREATE POLICY "secretaries_full_access_jobs" ON ad_generation_jobs
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE role = 'secretary'));

CREATE POLICY "secretaries_full_access_assets" ON ad_assets
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE role = 'secretary'));

CREATE POLICY "secretaries_full_access_videos" ON ad_videos
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE role = 'secretary'));

CREATE POLICY "secretaries_full_access_captions" ON caption_variants
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE role = 'secretary'));

CREATE POLICY "secretaries_full_access_queue" ON social_publish_queue
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE role = 'secretary'));

CREATE POLICY "secretaries_full_access_logs" ON social_publish_logs
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE role = 'secretary'));

CREATE POLICY "secretaries_full_access_analytics" ON ad_analytics
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE role = 'secretary'));

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_connected_accounts_user_platform ON connected_social_accounts(user_id, platform);
CREATE INDEX idx_connected_accounts_status ON connected_social_accounts(account_status);
CREATE INDEX idx_source_content_type ON source_content_refs(content_type);
CREATE INDEX idx_jobs_status ON ad_generation_jobs(job_status);
CREATE INDEX idx_jobs_source ON ad_generation_jobs(source_content_id);
CREATE INDEX idx_assets_job ON ad_assets(job_id);
CREATE INDEX idx_assets_primary ON ad_assets(job_id, is_primary);
CREATE INDEX idx_videos_job ON ad_videos(job_id);
CREATE INDEX idx_captions_job ON caption_variants(job_id);
CREATE INDEX idx_captions_selected ON caption_variants(job_id, is_selected);
CREATE INDEX idx_queue_status ON social_publish_queue(publish_status);
CREATE INDEX idx_queue_platform ON social_publish_queue(platform);
CREATE INDEX idx_queue_scheduled ON social_publish_queue(scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX idx_analytics_source ON ad_analytics(source_content_id);
CREATE INDEX idx_analytics_platform ON ad_analytics(platform);
CREATE INDEX idx_analytics_created ON ad_analytics(created_at);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get active social accounts for a user
CREATE OR REPLACE FUNCTION get_connected_accounts(user_uuid UUID)
RETURNS TABLE(
  id UUID,
  platform VARCHAR(20),
  platform_username VARCHAR(255),
  platform_display_name VARCHAR(255),
  account_status VARCHAR(20),
  last_synced_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    csa.id,
    csa.platform,
    csa.platform_username,
    csa.platform_display_name,
    csa.account_status,
    csa.last_synced_at
  FROM connected_social_accounts csa
  WHERE csa.user_id = user_uuid AND csa.account_status = 'active'
  ORDER BY csa.platform;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get pending ad jobs count
CREATE OR REPLACE FUNCTION get_pending_jobs_count()
RETURNS INTEGER AS $$
DECLARE
  count_val INTEGER;
BEGIN
  SELECT COUNT(*) INTO count_val
  FROM ad_generation_jobs
  WHERE job_status = 'pending';
  RETURN count_val;
END;
$$ LANGUAGE plpgsql;

-- Get publish queue stats
CREATE OR REPLACE FUNCTION get_publish_queue_stats()
RETURNS TABLE(
  total_draft INTEGER,
  total_scheduled INTEGER,
  total_published INTEGER,
  total_failed INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE publish_status = 'draft') as total_draft,
    COUNT(*) FILTER (WHERE publish_status = 'scheduled') as total_scheduled,
    COUNT(*) FILTER (WHERE publish_status = 'published') as total_published,
    COUNT(*) FILTER (WHERE publish_status = 'failed') as total_failed
  FROM social_publish_queue;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ENUMS (if not already defined)
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ad_platform') THEN
    CREATE TYPE ad_platform AS ENUM ('x', 'instagram');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ad_job_type') THEN
    CREATE TYPE ad_job_type AS ENUM ('image_ad', 'video_promo', 'caption_only', 'full_campaign');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ad_asset_type') THEN
    CREATE TYPE ad_asset_type AS ENUM ('square_post', 'portrait_story', 'landscape_promo', 'fallback_graphic');
  END IF;
EXCEPTION
  WHEN duplicate_object THEN null;
END
$$;