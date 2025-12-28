-- AI-Powered Verification System
CREATE TABLE IF NOT EXISTS verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  id_photo_url TEXT NOT NULL,
  selfie_url TEXT NOT NULL,
  ai_match_score NUMERIC(5, 2), -- 0-100
  ai_behavior_score NUMERIC(5, 2), -- 0-100
  status TEXT CHECK (status IN ('pending', 'approved', 'denied', 'in_review')) DEFAULT 'pending',
  influencer_tier BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  admin_reviewer UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  admin_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_verification_requests_user ON verification_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_requests_status ON verification_requests(status);
CREATE INDEX IF NOT EXISTS idx_verification_requests_created ON verification_requests(created_at DESC);

-- Add influencer and profile customization columns
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'influencer_tier') THEN
    ALTER TABLE user_profiles ADD COLUMN influencer_tier TEXT DEFAULT NULL CHECK (influencer_tier IN ('basic', 'gold', 'platinum'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'profile_banner_url') THEN
    ALTER TABLE user_profiles ADD COLUMN profile_banner_url TEXT DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'profile_theme') THEN
    ALTER TABLE user_profiles ADD COLUMN profile_theme TEXT DEFAULT NULL;
  END IF;
END $$;

-- Function to check influencer eligibility
CREATE OR REPLACE FUNCTION check_influencer_eligibility(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_followers_count INTEGER;
  v_coins_received INTEGER;
  v_is_verified BOOLEAN;
BEGIN
  SELECT 
    is_verified,
    (SELECT COUNT(*) FROM follows WHERE following_id = p_user_id) as followers,
    (SELECT COALESCE(SUM(coins), 0) FROM coin_transactions WHERE user_id = p_user_id AND type = 'gift_received')
  INTO v_is_verified, v_followers_count, v_coins_received
  FROM user_profiles
  WHERE id = p_user_id;

  IF v_is_verified = TRUE AND v_followers_count >= 200 AND v_coins_received >= 5000 THEN
    RETURN json_build_object(
      'eligible', true,
      'followers', v_followers_count,
      'coins_received', v_coins_received
    );
  END IF;

  RETURN json_build_object(
    'eligible', false,
    'followers', v_followers_count,
    'coins_received', v_coins_received,
    'needs_verified', NOT v_is_verified,
    'needs_followers', v_followers_count < 200,
    'needs_coins', v_coins_received < 5000
  );
END;
$$ LANGUAGE plpgsql;

-- Function to auto-upgrade to influencer tier
CREATE OR REPLACE FUNCTION auto_upgrade_influencer_tier()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_verified = TRUE AND (OLD.is_verified IS NULL OR OLD.is_verified = FALSE) THEN
    -- Check if user qualifies for influencer tier
    PERFORM check_influencer_eligibility(NEW.id);
    -- This can be called from application logic
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_upgrade_influencer ON user_profiles;
CREATE TRIGGER trigger_auto_upgrade_influencer
  AFTER UPDATE OF is_verified ON user_profiles
  FOR EACH ROW
  WHEN (NEW.is_verified = TRUE)
  EXECUTE FUNCTION auto_upgrade_influencer_tier();

-- Officer tier badges update
DO $$
BEGIN
  -- Update officer_level descriptions if needed
  -- This is handled in application logic, but we ensure the column exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'officer_level') THEN
    ALTER TABLE user_profiles ADD COLUMN officer_level INTEGER DEFAULT 1;
  END IF;
END $$;

