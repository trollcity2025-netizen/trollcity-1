-- Upgrade user_levels table for new Reward + Perk System

-- Ensure table exists (in case previous migration didn't run)
CREATE TABLE IF NOT EXISTS user_levels (
  user_id UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
  level INTEGER NOT NULL DEFAULT 1,
  xp BIGINT NOT NULL DEFAULT 0,
  total_xp BIGINT NOT NULL DEFAULT 0,
  next_level_xp BIGINT NOT NULL DEFAULT 100,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add new columns
DO $$ 
BEGIN
  -- Rename 'level' to 'current_level' if we want consistency, but 'level' is fine.
  -- Let's check if we need to rename or just use 'level'. 'level' is a reserved word in some contexts but fine in Postgres.
  -- We'll stick with 'level' as it exists.

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_levels' AND column_name = 'prestige_count') THEN
    ALTER TABLE user_levels ADD COLUMN prestige_count INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_levels' AND column_name = 'perk_tokens') THEN
    ALTER TABLE user_levels ADD COLUMN perk_tokens INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_levels' AND column_name = 'unlocked_perks') THEN
    ALTER TABLE user_levels ADD COLUMN unlocked_perks TEXT[] DEFAULT '{}';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_levels' AND column_name = 'daily_xp_log') THEN
    ALTER TABLE user_levels ADD COLUMN daily_xp_log JSONB DEFAULT '{"date": "", "chat_xp": 0, "watch_xp": 0}';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_levels' AND column_name = 'last_daily_login') THEN
    ALTER TABLE user_levels ADD COLUMN last_daily_login TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_levels' AND column_name = 'current_streak') THEN
    ALTER TABLE user_levels ADD COLUMN current_streak INTEGER DEFAULT 0;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_levels_total_xp ON user_levels(total_xp DESC);
CREATE INDEX IF NOT EXISTS idx_user_levels_level ON user_levels(level DESC);

-- RLS Policies
ALTER TABLE user_levels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all levels" ON user_levels;
CREATE POLICY "Users can view all levels" ON user_levels
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own level" ON user_levels;
CREATE POLICY "Users can update own level" ON user_levels
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RPC for adding coins securely
CREATE OR REPLACE FUNCTION add_troll_coins(user_id UUID, amount INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE user_profiles
  SET troll_coins = troll_coins + amount,
      total_earned_coins = total_earned_coins + amount
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


DROP POLICY IF EXISTS "Users can insert own level" ON user_levels;
CREATE POLICY "Users can insert own level" ON user_levels
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
