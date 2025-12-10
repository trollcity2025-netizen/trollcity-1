-- TrollTract Complete System Database Schema
-- Migration: create_trolltract_complete_system.sql

-- 1. Add TrollTract columns to profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS is_trolltract boolean DEFAULT false;

ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS trolltract_activated_at timestamptz;

-- 2. Create trolltract_bonus_log table for tracking 10% bonus earnings
CREATE TABLE IF NOT EXISTS trolltract_bonus_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references user_profiles(id) on delete cascade,
  gift_id uuid,
  stream_id uuid,
  base_amount bigint not null,
  bonus_amount bigint not null,
  total_amount bigint not null,
  sender_id uuid,
  created_at timestamptz default now()
);

-- 3. Create trolltract_events table for ranking boosts
CREATE TABLE IF NOT EXISTS trolltract_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references user_profiles(id) on delete cascade,
  event_type varchar(50) not null, -- 'shadow_mode', 'boosted_week', 'featured_show'
  start_date timestamptz not null,
  end_date timestamptz,
  is_active boolean default true,
  metadata jsonb,
  created_at timestamptz default now()
);

-- 4. Create trolltract_analytics table for earnings tracking
CREATE TABLE IF NOT EXISTS trolltract_analytics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references user_profiles(id) on delete cascade,
  date date not null,
  total_gifts bigint default 0,
  trolltract_bonus bigint default 0,
  total_earnings bigint default 0,
  unique_gifters integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  UNIQUE(user_id, date)
);

-- 5. Enable RLS on all TrollTract tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trolltract_bonus_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE trolltract_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE trolltract_analytics ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for user_profiles TrollTract fields
-- Users can view their own profile
CREATE POLICY "trolltract self select"
  ON user_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (but not trolltract status directly)
CREATE POLICY "trolltract self update limited"
  ON user_profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND 
    OLD.is_trolltract = NEW.is_trolltract AND
    OLD.trolltract_activated_at = NEW.trolltract_activated_at
  );

-- Only service role can update trolltract status
CREATE POLICY "trolltract controlled update"
  ON user_profiles
  FOR UPDATE
  USING (false);

-- 7. RLS Policies for trolltract_bonus_log
CREATE POLICY "trolltract bonus self select"
  ON trolltract_bonus_log
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "trolltract bonus service insert"
  ON trolltract_bonus_log
  FOR INSERT
  WITH CHECK (true);

-- 8. RLS Policies for trolltract_events
CREATE POLICY "trolltract events self select"
  ON trolltract_events
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "trolltract events service manage"
  ON trolltract_events
  FOR ALL
  USING (true);

-- 9. RLS Policies for trolltract_analytics
CREATE POLICY "trolltract analytics self select"
  ON trolltract_analytics
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "trolltract analytics service manage"
  ON trolltract_analytics
  FOR ALL
  USING (true);

-- 10. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_trolltract_bonus_log_user_id ON trolltract_bonus_log(user_id);
CREATE INDEX IF NOT EXISTS idx_trolltract_bonus_log_created_at ON trolltract_bonus_log(created_at);
CREATE INDEX IF NOT EXISTS idx_trolltract_events_user_id ON trolltract_events(user_id);
CREATE INDEX IF NOT EXISTS idx_trolltract_analytics_user_id_date ON trolltract_analytics(user_id, date);
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_trolltract ON user_profiles(is_trolltract) WHERE is_trolltract = true;

-- 11. Create function to automatically update analytics
CREATE OR REPLACE FUNCTION update_trolltract_daily_analytics()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO trolltract_analytics (user_id, date, total_gifts, trolltract_bonus, total_earnings, unique_gifters)
  VALUES (
    NEW.user_id,
    CURRENT_DATE,
    NEW.base_amount + NEW.bonus_amount,
    NEW.bonus_amount,
    NEW.total_amount,
    1
  )
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    total_gifts = trolltract_analytics.total_gifts + NEW.base_amount + NEW.bonus_amount,
    trolltract_bonus = trolltract_analytics.trolltract_bonus + NEW.bonus_amount,
    total_earnings = trolltract_analytics.total_earnings + NEW.total_amount,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 12. Create trigger for automatic analytics updates
CREATE TRIGGER trigger_update_trolltract_analytics
  AFTER INSERT ON trolltract_bonus_log
  FOR EACH ROW
  EXECUTE FUNCTION update_trolltract_daily_analytics();

-- 13. Add comments for documentation
COMMENT ON TABLE trolltract_bonus_log IS 'Tracks 10% bonus earnings for TrollTract creators';
COMMENT ON TABLE trolltract_events IS 'Manages special events and boosts for TrollTract creators';
COMMENT ON TABLE trolltract_analytics IS 'Daily analytics for TrollTract creator earnings and performance';
COMMENT ON COLUMN user_profiles.is_trolltract IS 'Whether user has activated TrollTract contract (20,000 coins)';
COMMENT ON COLUMN user_profiles.trolltract_activated_at IS 'Timestamp when TrollTract was activated';