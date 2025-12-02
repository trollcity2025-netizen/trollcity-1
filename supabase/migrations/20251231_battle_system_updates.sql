-- Battle System Updates: streams_participants, chat_messages, and gifts updates

-- 1. Create streams_participants table to track participants in streams
CREATE TABLE IF NOT EXISTS streams_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'guest' CHECK (role IN ('host', 'opponent', 'guest')),
  livekit_identity text, -- Maps to LiveKit participant identity
  livekit_participant_id text,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(stream_id, user_id, role) -- One user can only have one role per stream
);

CREATE INDEX IF NOT EXISTS idx_streams_participants_stream_id ON streams_participants(stream_id);
CREATE INDEX IF NOT EXISTS idx_streams_participants_user_id ON streams_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_streams_participants_active ON streams_participants(stream_id, is_active) WHERE is_active = true;

-- 2. Update gifts table to add battle_id (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'gifts' AND column_name = 'battle_id'
  ) THEN
    ALTER TABLE gifts ADD COLUMN battle_id uuid REFERENCES troll_battles(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_gifts_battle_id ON gifts(battle_id);
  END IF;
END $$;

-- Ensure receiver_id exists (it should already exist from previous migrations)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'gifts' AND column_name = 'receiver_id'
  ) THEN
    ALTER TABLE gifts ADD COLUMN receiver_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_gifts_receiver_id ON gifts(receiver_id);
  END IF;
END $$;

-- 3. Create chat_messages table (if not exists) for shared battle chat
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  battle_id uuid REFERENCES troll_battles(id) ON DELETE SET NULL,
  sender_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  message text NOT NULL,
  message_type text DEFAULT 'chat' CHECK (message_type IN ('chat', 'system', 'gift_announcement')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_stream_id ON chat_messages(stream_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_battle_id ON chat_messages(battle_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(stream_id, created_at DESC);

-- 4. Update troll_battles to support new battle system
DO $$ 
BEGIN
  -- Add stream_id if it doesn't exist (single stream for battle)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'troll_battles' AND column_name = 'stream_id'
  ) THEN
    ALTER TABLE troll_battles ADD COLUMN stream_id uuid REFERENCES streams(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_troll_battles_stream_id ON troll_battles(stream_id);
  END IF;
  
  -- Add mode column for battle type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'troll_battles' AND column_name = 'mode'
  ) THEN
    ALTER TABLE troll_battles ADD COLUMN mode text DEFAULT 'battle' CHECK (mode IN ('solo', 'battle', 'multi'));
  END IF;
END $$;

-- 5. Add trigger for streams_participants updated_at
CREATE OR REPLACE FUNCTION update_streams_participants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_streams_participants_updated_at ON streams_participants;
CREATE TRIGGER update_streams_participants_updated_at
  BEFORE UPDATE ON streams_participants
  FOR EACH ROW
  EXECUTE FUNCTION update_streams_participants_updated_at();

-- 6. Enable RLS
ALTER TABLE streams_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for streams_participants
CREATE POLICY "Anyone can view active participants"
  ON streams_participants FOR SELECT
  USING (true);

CREATE POLICY "Users can join as participants"
  ON streams_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own participation"
  ON streams_participants FOR UPDATE
  USING (auth.uid() = user_id);

-- 8. RLS Policies for chat_messages
CREATE POLICY "Anyone can view chat messages for a stream"
  ON chat_messages FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can send chat messages"
  ON chat_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- 9. Grant permissions
GRANT SELECT, INSERT, UPDATE ON streams_participants TO authenticated;
GRANT SELECT, INSERT ON chat_messages TO authenticated;

COMMENT ON TABLE streams_participants IS 'Tracks participants (host, opponent, guests) in streams with LiveKit integration';
COMMENT ON TABLE chat_messages IS 'Shared chat messages for streams and battles';
COMMENT ON COLUMN gifts.battle_id IS 'Optional battle_id for gifts sent during battles';
COMMENT ON COLUMN gifts.receiver_id IS 'Target user_id for gift (can be host, opponent, or guest)';

