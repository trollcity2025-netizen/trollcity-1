-- Create troll events system for global walking troll animations

-- Troll events table (global events that affect all streams)
CREATE TABLE troll_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  troll_type TEXT NOT NULL CHECK (troll_type IN ('red', 'green')),
  reward_amount INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  active BOOLEAN DEFAULT true
);

-- Troll event claims (one per user per event)
CREATE TABLE troll_event_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES troll_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- Indexes for performance
CREATE INDEX idx_troll_events_active ON troll_events(active, expires_at);
CREATE INDEX idx_troll_events_created ON troll_events(created_at DESC);
CREATE INDEX idx_troll_event_claims_event ON troll_event_claims(event_id);
CREATE INDEX idx_troll_event_claims_user ON troll_event_claims(user_id);

-- Enable RLS
ALTER TABLE troll_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE troll_event_claims ENABLE ROW LEVEL SECURITY;

-- Policies for troll_events (anyone can read active events)
CREATE POLICY "Anyone can view active troll events" ON troll_events
  FOR SELECT USING (active = true AND expires_at > NOW());

-- Policies for troll_event_claims (users can only see/modify their own claims)
CREATE POLICY "Users can view their own claims" ON troll_event_claims
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own claims" ON troll_event_claims
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Function to spawn a troll event
CREATE OR REPLACE FUNCTION spawn_troll_event(
  p_troll_type TEXT DEFAULT 'green',
  p_reward_amount INTEGER DEFAULT 10,
  p_duration_minutes INTEGER DEFAULT 2
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  event_id UUID;
BEGIN
  -- Deactivate any existing active events
  UPDATE troll_events SET active = false WHERE active = true;

  -- Create new event
  INSERT INTO troll_events (troll_type, reward_amount, expires_at)
  VALUES (p_troll_type, p_reward_amount, NOW() + INTERVAL '1 minute' * p_duration_minutes)
  RETURNING id INTO event_id;

  RETURN event_id;
END;
$$;

-- Function to claim troll event reward
CREATE OR REPLACE FUNCTION claim_troll_event(
  p_event_id UUID,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  event_record RECORD;
  claim_count INTEGER;
  new_balance INTEGER;
BEGIN
  -- Get event details
  SELECT * INTO event_record
  FROM troll_events
  WHERE id = p_event_id AND active = true AND expires_at > NOW();

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Event not found or expired');
  END IF;

  -- Check if user already claimed
  SELECT COUNT(*) INTO claim_count
  FROM troll_event_claims
  WHERE event_id = p_event_id AND user_id = p_user_id;

  IF claim_count > 0 THEN
    RETURN json_build_object('success', false, 'error', 'Already claimed');
  END IF;

  -- Get user profile
  SELECT free_coin_balance INTO new_balance
  FROM user_profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Record claim
  INSERT INTO troll_event_claims (event_id, user_id)
  VALUES (p_event_id, p_user_id);

  -- Add reward to user balance
  UPDATE user_profiles
  SET free_coin_balance = free_coin_balance + event_record.reward_amount
  WHERE id = p_user_id;

  -- Record transaction
  INSERT INTO coin_transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'troll_event', event_record.reward_amount, 'Troll event reward');

  RETURN json_build_object(
    'success', true,
    'reward_amount', event_record.reward_amount,
    'new_balance', new_balance + event_record.reward_amount
  );
END;
$$;