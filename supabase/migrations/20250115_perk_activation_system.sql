-- Perk Activation System
-- Ensures perks are properly activated when purchased and tracked in database

-- Create user_perks table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_perks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  perk_id TEXT NOT NULL,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  activated_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, perk_id, expires_at)
);

CREATE INDEX IF NOT EXISTS idx_user_perks_user ON user_perks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_perks_active ON user_perks(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_perks_expires ON user_perks(expires_at);

-- Enable RLS
ALTER TABLE user_perks ENABLE ROW LEVEL SECURITY;

-- Users can view their own perks
CREATE POLICY "Users can view own perks"
  ON user_perks FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own perks
CREATE POLICY "Users can insert own perks"
  ON user_perks FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Function to activate a perk
CREATE OR REPLACE FUNCTION activate_perk(
  p_user_id UUID,
  p_perk_id TEXT,
  p_duration_minutes INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expires_at TIMESTAMPTZ;
  v_perk_record UUID;
BEGIN
  -- Calculate expiry time
  v_expires_at := NOW() + (p_duration_minutes || ' minutes')::INTERVAL;

  -- Insert or update perk record
  INSERT INTO user_perks (
    user_id,
    perk_id,
    expires_at,
    is_active,
    activated_at
  ) VALUES (
    p_user_id,
    p_perk_id,
    v_expires_at,
    true,
    NOW()
  )
  ON CONFLICT (user_id, perk_id, expires_at) DO UPDATE
  SET 
    is_active = true,
    activated_at = NOW(),
    updated_at = NOW()
  RETURNING id INTO v_perk_record;

  RETURN jsonb_build_object(
    'success', true,
    'perk_id', p_perk_id,
    'expires_at', v_expires_at,
    'record_id', v_perk_record
  );
END;
$$;

GRANT EXECUTE ON FUNCTION activate_perk(UUID, TEXT, INTEGER) TO authenticated;

-- Function to check if user has active perk
CREATE OR REPLACE FUNCTION has_active_perk(
  p_user_id UUID,
  p_perk_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM user_perks
    WHERE user_id = p_user_id
      AND perk_id = p_perk_id
      AND is_active = true
      AND expires_at > NOW()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION has_active_perk(UUID, TEXT) TO authenticated;

-- Function to get all active perks for a user
CREATE OR REPLACE FUNCTION get_active_perks(p_user_id UUID)
RETURNS TABLE (
  perk_id TEXT,
  expires_at TIMESTAMPTZ,
  metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.perk_id,
    up.expires_at,
    up.metadata
  FROM user_perks up
  WHERE up.user_id = p_user_id
    AND up.is_active = true
    AND up.expires_at > NOW()
  ORDER BY up.expires_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_active_perks(UUID) TO authenticated;

-- Auto-deactivate expired perks
CREATE OR REPLACE FUNCTION deactivate_expired_perks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE user_perks
  SET is_active = false, updated_at = NOW()
  WHERE is_active = true
    AND expires_at <= NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON TABLE user_perks IS 'Tracks purchased and activated perks for users';
COMMENT ON FUNCTION activate_perk IS 'Activates a perk for a user with specified duration';
COMMENT ON FUNCTION has_active_perk IS 'Checks if user has an active perk';
COMMENT ON FUNCTION get_active_perks IS 'Returns all active perks for a user';

