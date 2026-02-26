-- Featured Broadcast System
-- Tracks featured broadcasts, top 100 rankings, and weekly top saved for Universe Events

-- Table to track featured broadcasts (1000+ likes, 2000+ gifts)
CREATE TABLE IF NOT EXISTS featured_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  likes_count INTEGER DEFAULT 0,
  gifts_value INTEGER DEFAULT 0,
  featured_at TIMESTAMPTZ DEFAULT NOW(),
  is_featured BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for hourly top 100 rankings
CREATE TABLE IF NOT EXISTS broadcast_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  rank_position INTEGER NOT NULL,
  likes_count INTEGER DEFAULT 0,
  gifts_value INTEGER DEFAULT 0,
  viewer_count INTEGER DEFAULT 0,
  total_score INTEGER DEFAULT 0,
  ranking_hour TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table to save weekly top featured broadcasters for Universe Events
CREATE TABLE IF NOT EXISTS weekly_top_broadcasters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  rank_position INTEGER NOT NULL,
  total_likes INTEGER DEFAULT 0,
  total_gifts INTEGER DEFAULT 0,
  total_viewers INTEGER DEFAULT 0,
  avg_viewers INTEGER DEFAULT 0,
  is_universe_invited BOOLEAN DEFAULT FALSE,
  universe_event_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_start_date)
);

-- Enable RLS
ALTER TABLE featured_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_top_broadcasters ENABLE ROW LEVEL SECURITY;

-- RLS Policies for featured_broadcasts
CREATE POLICY "Anyone can view featured broadcasts"
ON featured_broadcasts FOR SELECT USING (is_featured = true);

CREATE POLICY "System can manage featured broadcasts"
ON featured_broadcasts FOR ALL USING (
  auth.uid() IN (SELECT id FROM auth.users WHERE email LIKE '%@system%')
  OR auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin')
);

-- RLS Policies for broadcast_rankings
CREATE POLICY "Anyone can view rankings"
ON broadcast_rankings FOR SELECT USING (true);

CREATE POLICY "System can manage rankings"
ON broadcast_rankings FOR ALL USING (
  auth.uid() IN (SELECT id FROM auth.users WHERE email LIKE '%@system%')
  OR auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin')
);

-- RLS Policies for weekly_top_broadcasters
CREATE POLICY "Anyone can view weekly top"
ON weekly_top_broadcasters FOR SELECT USING (true);

CREATE POLICY "System can manage weekly top"
ON weekly_top_broadcasters FOR ALL USING (
  auth.uid() IN (SELECT id FROM auth.users WHERE email LIKE '%@system%')
  OR auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin')
);

-- Add columns to streams table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'streams' AND column_name = 'likes_count'
  ) THEN
    ALTER TABLE streams ADD COLUMN likes_count INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'streams' AND column_name = 'gifts_value'
  ) THEN
    ALTER TABLE streams ADD COLUMN gifts_value INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'streams' AND column_name = 'is_featured'
  ) THEN
    ALTER TABLE streams ADD COLUMN is_featured BOOLEAN DEFAULT FALSE;
  END IF;
END
$$;

-- Function to update stream metrics and check for featured status
CREATE OR REPLACE FUNCTION update_stream_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Update likes count
  IF TG_TABLE_NAME = 'stream_likes' THEN
    UPDATE streams 
    SET likes_count = COALESCE((
      SELECT COUNT(*) FROM stream_likes 
      WHERE stream_id = NEW.stream_id
    ), 0)
    WHERE id = NEW.stream_id;
  END IF;
  
  -- Update gifts value
  IF TG_TABLE_NAME = 'stream_gifts' THEN
    UPDATE streams 
    SET gifts_value = COALESCE((
      SELECT COALESCE(SUM(coins_spent), 0) FROM stream_gifts 
      WHERE stream_id = NEW.stream_id
    ), 0)
    WHERE id = NEW.stream_id;
  END IF;
  
  -- Check and update featured status
  UPDATE streams 
  SET is_featured = CASE 
    WHEN likes_count >= 1000 AND gifts_value >= 2000 THEN TRUE 
    ELSE FALSE 
  END
  WHERE id = COALESCE(NEW.stream_id, OLD.stream_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update featured status when likes/gifts change
CREATE OR REPLACE FUNCTION setup_stream_metrics_triggers()
RETURNS VOID AS $$
BEGIN
  -- Drop existing triggers if they exist
  DROP TRIGGER IF EXISTS update_stream_likes_trigger ON stream_likes;
  DROP TRIGGER IF EXISTS update_stream_gifts_trigger ON stream_gifts;
  
  -- Create triggers
  CREATE TRIGGER update_stream_likes_trigger
    AFTER INSERT OR DELETE ON stream_likes
    FOR EACH ROW EXECUTE FUNCTION update_stream_metrics();
    
  CREATE TRIGGER update_stream_gifts_trigger
    AFTER INSERT OR DELETE ON stream_gifts
    FOR EACH ROW EXECUTE FUNCTION update_stream_metrics();
END;
$$ LANGUAGE plpgsql;

-- Run the trigger setup
SELECT setup_stream_metrics_triggers();

-- Function to calculate hourly rankings
CREATE OR REPLACE FUNCTION calculate_hourly_rankings()
RETURNS VOID AS $$
DECLARE
  ranking_stream RECORD;
  current_rank INTEGER := 1;
BEGIN
  -- Clear old rankings (keep last 48 hours)
  DELETE FROM broadcast_rankings 
  WHERE ranking_hour < NOW() - INTERVAL '48 hours';
  
  -- Insert new rankings from current live streams
  FOR ranking_stream IN
    SELECT 
      s.id as stream_id,
      s.user_id,
      s.likes_count,
      s.gifts_value,
      s.viewer_count,
      (COALESCE(s.likes_count, 0) * 1) + 
      (COALESCE(s.gifts_value, 0) * 5) + 
      (COALESCE(s.viewer_count, 0) * 2) as total_score
    FROM streams s
    WHERE s.is_live = true
    ORDER BY total_score DESC
    LIMIT 100
  LOOP
    INSERT INTO broadcast_rankings (
      stream_id,
      user_id,
      rank_position,
      likes_count,
      gifts_value,
      viewer_count,
      total_score,
      ranking_hour
    ) VALUES (
      ranking_stream.stream_id,
      ranking_stream.user_id,
      current_rank,
      ranking_stream.likes_count,
      ranking_stream.gifts_value,
      ranking_stream.viewer_count,
      ranking_stream.total_score,
      NOW()
    );
    
    current_rank := current_rank + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to save weekly top broadcasters
CREATE OR REPLACE FUNCTION save_weekly_top_broadcasters()
RETURNS VOID AS $$
DECLARE
  current_week_start DATE;
  current_week_end DATE;
  week_broadcaster RECORD;
  week_rank INTEGER := 1;
BEGIN
  -- Calculate current week (Monday to Sunday)
  current_week_start := DATE_TRUNC('week', CURRENT_DATE)::DATE;
  current_week_end := (current_week_start + INTERVAL '6 days')::DATE;
  
  -- Clear old entries for this week
  DELETE FROM weekly_top_broadcasters 
  WHERE week_start_date = current_week_start;
  
  -- Insert top 10 from the week
  FOR week_broadcaster IN
    SELECT 
      s.user_id,
      SUM(COALESCE(s.likes_count, 0)) as total_likes,
      SUM(COALESCE(s.gifts_value, 0)) as total_gifts,
      SUM(COALESCE(s.viewer_count, 0)) as total_viewers,
      AVG(COALESCE(s.viewer_count, 0)) as avg_viewers
    FROM streams s
    WHERE s.is_featured = true
      AND s.created_at::date BETWEEN current_week_start AND current_week_end
    GROUP BY s.user_id
    ORDER BY (SUM(COALESCE(s.likes_count, 0)) * 1) + 
             (SUM(COALESCE(s.gifts_value, 0)) * 5) + 
             (SUM(COALESCE(s.viewer_count, 0)) * 2) DESC
    LIMIT 10
  LOOP
    INSERT INTO weekly_top_broadcasters (
      user_id,
      week_start_date,
      week_end_date,
      rank_position,
      total_likes,
      total_gifts,
      total_viewers,
      avg_viewers
    ) VALUES (
      week_broadcaster.user_id,
      current_week_start,
      current_week_end,
      week_rank,
      week_broadcaster.total_likes,
      week_broadcaster.total_gifts,
      week_broadcaster.total_viewers,
      week_broadcaster.avg_viewers
    );
    
    week_rank := week_rank + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Cron job to run hourly rankings (if pg_cron is available)
-- This would typically be set up in the database's cron extension
-- For now, the function can be called manually or via API

COMMENT ON TABLE featured_broadcasts IS 'Tracks broadcasts that have reached 1000+ likes and 2000+ gifts';
COMMENT ON TABLE broadcast_rankings IS 'Hourly top 100 broadcast rankings';
COMMENT ON TABLE weekly_top_broadcasters IS 'Weekly top featured broadcasters saved for Universe Events';
