-- Create tromody_queue table for matchmaking
CREATE TABLE tromody_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'searching' CHECK (status IN ('searching', 'matched', 'exited')),
  match_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create tromody_matches table
CREATE TABLE tromody_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id UUID REFERENCES auth.users(id),
  player2_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'rematch_pending')),
  winner_id UUID REFERENCES auth.users(id),
  room_name TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE tromody_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE tromody_matches ENABLE ROW LEVEL SECURITY;

-- Policies for tromody_queue
CREATE POLICY "Users can insert their own queue entry" ON tromody_queue
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own queue entry" ON tromody_queue
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own queue entry" ON tromody_queue
  FOR SELECT USING (auth.uid() = user_id);

-- Policies for tromody_matches
CREATE POLICY "Users can view matches they are in" ON tromody_matches
  FOR SELECT USING (auth.uid() = player1_id OR auth.uid() = player2_id);

CREATE POLICY "Users can update matches they are in" ON tromody_matches
  FOR UPDATE USING (auth.uid() = player1_id OR auth.uid() = player2_id);

-- Function to find and match players
CREATE OR REPLACE FUNCTION find_tromody_match()
RETURNS UUID AS $$
DECLARE
  player1 RECORD;
  player2 RECORD;
  match_uuid UUID;
  room_name TEXT;
BEGIN
  -- Find two searching players
  SELECT * INTO player1 FROM tromody_queue WHERE status = 'searching' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO player2 FROM tromody_queue WHERE status = 'searching' AND user_id != player1.user_id ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Create match
  match_uuid := gen_random_uuid();
  room_name := 'tromody_match_' || match_uuid::text;

  INSERT INTO tromody_matches (id, player1_id, player2_id, room_name)
  VALUES (match_uuid, player1.user_id, player2.user_id, room_name);

  -- Update queue entries
  UPDATE tromody_queue SET status = 'matched', match_id = match_uuid, updated_at = NOW() WHERE user_id IN (player1.user_id, player2.user_id);

  RETURN match_uuid;
END;
$$ LANGUAGE plpgsql;