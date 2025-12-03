-- ============================================
-- PART 1: FIX MESSAGES TABLE AND RLS POLICIES
-- ============================================

-- Ensure messages table has all required columns
DO $$ 
BEGIN
  -- Add sender_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'sender_id'
  ) THEN
    ALTER TABLE messages ADD COLUMN sender_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE;
  END IF;

  -- Add receiver_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'receiver_id'
  ) THEN
    ALTER TABLE messages ADD COLUMN receiver_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE;
  END IF;

  -- Add seen column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'seen'
  ) THEN
    ALTER TABLE messages ADD COLUMN seen BOOLEAN DEFAULT FALSE;
  END IF;

  -- Add read_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'read_at'
  ) THEN
    ALTER TABLE messages ADD COLUMN read_at TIMESTAMPTZ;
  END IF;

  -- Ensure message_type exists and has default
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'message_type'
  ) THEN
    ALTER TABLE messages ADD COLUMN message_type TEXT DEFAULT 'dm';
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver ON messages(sender_id, receiver_id) WHERE message_type = 'dm';
CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread ON messages(receiver_id, seen, read_at) WHERE message_type = 'dm' AND (seen = false OR read_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_messages_stream_id ON messages(stream_id) WHERE stream_id IS NOT NULL;

-- Drop existing conflicting policies
DROP POLICY IF EXISTS "messages_select" ON messages;
DROP POLICY IF EXISTS "messages_insert_self" ON messages;
DROP POLICY IF EXISTS "messages_update_self" ON messages;

-- Create comprehensive RLS policies for messages
-- SELECT: Users can see messages where they are sender or receiver, or stream messages
CREATE POLICY "messages_select_own" 
ON messages 
FOR SELECT 
TO authenticated 
USING (
  sender_id = auth.uid() OR 
  receiver_id = auth.uid() OR
  (stream_id IS NOT NULL) OR
  auth.role() = 'service_role'
);

-- INSERT: Users can insert messages where they are the sender
CREATE POLICY "messages_insert_own" 
ON messages 
FOR INSERT 
TO authenticated 
WITH CHECK (
  sender_id = auth.uid() OR
  (sender_id IS NULL AND user_id = auth.uid())
);

-- UPDATE: Users can update messages they received (mark as read)
CREATE POLICY "messages_update_own" 
ON messages 
FOR UPDATE 
TO authenticated 
USING (receiver_id = auth.uid())
WITH CHECK (receiver_id = auth.uid());

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PART 2: CREATE CALL MINUTES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS call_minutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  audio_minutes INTEGER DEFAULT 0 NOT NULL CHECK (audio_minutes >= 0),
  video_minutes INTEGER DEFAULT 0 NOT NULL CHECK (video_minutes >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_call_minutes_user_id ON call_minutes(user_id);

-- RLS policies for call_minutes
ALTER TABLE call_minutes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "call_minutes_select_own" ON call_minutes;
DROP POLICY IF EXISTS "call_minutes_insert_own" ON call_minutes;
DROP POLICY IF EXISTS "call_minutes_update_own" ON call_minutes;

CREATE POLICY "call_minutes_select_own" 
ON call_minutes 
FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

CREATE POLICY "call_minutes_insert_own" 
ON call_minutes 
FOR INSERT 
TO authenticated 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "call_minutes_update_own" 
ON call_minutes 
FOR UPDATE 
TO authenticated 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ============================================
-- PART 3: CREATE CALL HISTORY TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS call_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  room_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('audio', 'video')),
  duration_minutes INTEGER DEFAULT 0 NOT NULL CHECK (duration_minutes >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_call_history_caller ON call_history(caller_id);
CREATE INDEX IF NOT EXISTS idx_call_history_receiver ON call_history(receiver_id);
CREATE INDEX IF NOT EXISTS idx_call_history_room ON call_history(room_id);

-- RLS policies for call_history
ALTER TABLE call_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "call_history_select_own" ON call_history;
DROP POLICY IF EXISTS "call_history_insert_own" ON call_history;

CREATE POLICY "call_history_select_own" 
ON call_history 
FOR SELECT 
TO authenticated 
USING (caller_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "call_history_insert_own" 
ON call_history 
FOR INSERT 
TO authenticated 
WITH CHECK (caller_id = auth.uid() OR receiver_id = auth.uid());

-- ============================================
-- PART 4: CREATE RPC FUNCTIONS FOR CALL MINUTES
-- ============================================

-- Function to add call minutes
CREATE OR REPLACE FUNCTION add_call_minutes(
  p_user_id UUID,
  p_minutes INTEGER,
  p_type TEXT -- 'audio' or 'video'
) RETURNS JSONB AS $$
DECLARE
  v_current_audio INTEGER := 0;
  v_current_video INTEGER := 0;
BEGIN
  -- Get current balance
  SELECT COALESCE(audio_minutes, 0), COALESCE(video_minutes, 0)
  INTO v_current_audio, v_current_video
  FROM call_minutes
  WHERE user_id = p_user_id;

  -- Update or insert
  IF v_current_audio IS NULL THEN
    INSERT INTO call_minutes (user_id, audio_minutes, video_minutes, updated_at)
    VALUES (
      p_user_id,
      CASE WHEN p_type = 'audio' THEN p_minutes ELSE 0 END,
      CASE WHEN p_type = 'video' THEN p_minutes ELSE 0 END,
      NOW()
    );
  ELSE
    UPDATE call_minutes
    SET 
      audio_minutes = CASE WHEN p_type = 'audio' THEN audio_minutes + p_minutes ELSE audio_minutes END,
      video_minutes = CASE WHEN p_type = 'video' THEN video_minutes + p_minutes ELSE video_minutes END,
      updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'audio_minutes', CASE WHEN p_type = 'audio' THEN v_current_audio + p_minutes ELSE v_current_audio END,
    'video_minutes', CASE WHEN p_type = 'video' THEN v_current_video + p_minutes ELSE v_current_video END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to deduct call minutes
CREATE OR REPLACE FUNCTION deduct_call_minutes(
  p_user_id UUID,
  p_minutes INTEGER,
  p_type TEXT -- 'audio' or 'video'
) RETURNS JSONB AS $$
DECLARE
  v_current_audio INTEGER := 0;
  v_current_video INTEGER := 0;
  v_new_audio INTEGER;
  v_new_video INTEGER;
BEGIN
  -- Get current balance
  SELECT COALESCE(audio_minutes, 0), COALESCE(video_minutes, 0)
  INTO v_current_audio, v_current_video
  FROM call_minutes
  WHERE user_id = p_user_id;

  -- Calculate new balances
  IF p_type = 'audio' THEN
    v_new_audio := GREATEST(0, v_current_audio - p_minutes);
    v_new_video := v_current_video;
  ELSE -- video uses 2x minutes
    v_new_audio := v_current_audio;
    v_new_video := GREATEST(0, v_current_video - (p_minutes * 2));
  END IF;

  -- Update balance
  UPDATE call_minutes
  SET 
    audio_minutes = v_new_audio,
    video_minutes = v_new_video,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Return result
  RETURN jsonb_build_object(
    'success', true,
    'has_minutes', CASE WHEN p_type = 'audio' THEN v_new_audio > 0 ELSE v_new_video > 0 END,
    'audio_minutes', v_new_audio,
    'video_minutes', v_new_video
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get call balances
CREATE OR REPLACE FUNCTION get_call_balances(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_audio INTEGER := 0;
  v_video INTEGER := 0;
BEGIN
  SELECT COALESCE(audio_minutes, 0), COALESCE(video_minutes, 0)
  INTO v_audio, v_video
  FROM call_minutes
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'audio_minutes', v_audio,
    'video_minutes', v_video
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION add_call_minutes(UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION deduct_call_minutes(UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_call_balances(UUID) TO authenticated;

COMMENT ON TABLE call_minutes IS 'Stores call minute balances for users';
COMMENT ON TABLE call_history IS 'Stores call history records';
COMMENT ON FUNCTION add_call_minutes IS 'Adds call minutes to user balance';
COMMENT ON FUNCTION deduct_call_minutes IS 'Deducts call minutes from user balance';
COMMENT ON FUNCTION get_call_balances IS 'Gets current call minute balances for a user';

