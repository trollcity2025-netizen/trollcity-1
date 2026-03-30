-- 5v5 Battle System Migration
-- Creates the battle_sessions table and supporting functions

-- Battle sessions table
CREATE TABLE IF NOT EXISTS battle_sessions (
  id TEXT PRIMARY KEY,
  stream_id_a TEXT NOT NULL,
  stream_id_b TEXT NOT NULL,
  host_id_a UUID NOT NULL REFERENCES auth.users(id),
  host_id_b UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pre_battle' CHECK (status IN ('pre_battle', 'active', 'ended', 'cancelled')),
  participants JSONB NOT NULL DEFAULT '[]',
  score_a INTEGER NOT NULL DEFAULT 0,
  score_b INTEGER NOT NULL DEFAULT 0,
  gift_count_a INTEGER NOT NULL DEFAULT 0,
  gift_count_b INTEGER NOT NULL DEFAULT 0,
  winner TEXT CHECK (winner IN ('A', 'B', 'draw')),
  abilities_used JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER NOT NULL DEFAULT 180
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_battle_sessions_status ON battle_sessions(status);
CREATE INDEX IF NOT EXISTS idx_battle_sessions_stream_a ON battle_sessions(stream_id_a);
CREATE INDEX IF NOT EXISTS idx_battle_sessions_stream_b ON battle_sessions(stream_id_b);
CREATE INDEX IF NOT EXISTS idx_battle_sessions_host_a ON battle_sessions(host_id_a);
CREATE INDEX IF NOT EXISTS idx_battle_sessions_host_b ON battle_sessions(host_id_b);

-- RLS
ALTER TABLE battle_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Battle sessions are viewable by everyone"
  ON battle_sessions FOR SELECT
  USING (true);

CREATE POLICY "Hosts can create battle sessions"
  ON battle_sessions FOR INSERT
  WITH CHECK (auth.uid() = host_id_a OR auth.uid() = host_id_b);

CREATE POLICY "Hosts can update their battle sessions"
  ON battle_sessions FOR UPDATE
  USING (auth.uid() = host_id_a OR auth.uid() = host_id_b);

-- Function: find_5v5_match
-- Finds a random live broadcaster in General Chat category who is not the caller
CREATE OR REPLACE FUNCTION find_5v5_match(p_stream_id TEXT)
RETURNS TABLE (
  id TEXT,
  user_id UUID,
  title TEXT,
  category TEXT,
  current_viewers INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stream RECORD;
BEGIN
  -- Get the current stream's info
  SELECT s.user_id, s.category INTO v_stream
  FROM streams s
  WHERE s.id = p_stream_id AND s.status = 'live';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stream not found or not live';
  END IF;

  -- Only allow General Chat category
  IF v_stream.category != 'general' THEN
    RAISE EXCEPTION '5v5 battles are only available in General Chat category';
  END IF;

  -- Find a random opponent live stream in General Chat
  -- Exclude the caller's stream
  -- Exclude streams that already have an active battle
  RETURN QUERY
  SELECT s.id, s.user_id, s.title, s.category, s.current_viewers
  FROM streams s
  WHERE s.status = 'live'
    AND s.category = 'general'
    AND s.id != p_stream_id
    AND s.user_id != v_stream.user_id
    AND NOT EXISTS (
      SELECT 1 FROM battle_sessions bs
      WHERE (bs.stream_id_a = s.id OR bs.stream_id_b = s.id)
        AND bs.status IN ('pre_battle', 'active')
    )
  ORDER BY RANDOM()
  LIMIT 1;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION find_5v5_match TO authenticated;
