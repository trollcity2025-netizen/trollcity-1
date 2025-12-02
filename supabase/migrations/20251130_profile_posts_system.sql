-- Profile Posts System
-- Allows users to create posts from their profile that auto-share to Troll City Wall

-- Add profile_view_price column if it doesn't exist
ALTER TABLE user_profiles 
  ADD COLUMN IF NOT EXISTS profile_view_price INTEGER DEFAULT 0;

-- Create troll_post_comments table if it doesn't exist
CREATE TABLE IF NOT EXISTS troll_post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES troll_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_troll_post_comments_post_id ON troll_post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_troll_post_comments_user_id ON troll_post_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_troll_post_comments_created_at ON troll_post_comments(created_at DESC);

-- Enable RLS on comments
ALTER TABLE troll_post_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for comments
DROP POLICY IF EXISTS "Anyone can view comments" ON troll_post_comments;
CREATE POLICY "Anyone can view comments" 
  ON troll_post_comments FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Users can insert their own comments" ON troll_post_comments;
CREATE POLICY "Users can insert their own comments" 
  ON troll_post_comments FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own comments" ON troll_post_comments;
CREATE POLICY "Users can delete their own comments" 
  ON troll_post_comments FOR DELETE 
  USING (auth.uid() = user_id);

-- Function to get gifters list for a user
CREATE OR REPLACE FUNCTION get_user_gifters(p_user_id UUID)
RETURNS TABLE (
  gifter_id UUID,
  gifter_username TEXT,
  gifter_avatar_url TEXT,
  total_gifts_sent BIGINT,
  total_coins_sent BIGINT,
  last_gift_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.sender_id,
    up.username,
    up.avatar_url,
    COUNT(*)::BIGINT as total_gifts,
    SUM(g.coins_spent)::BIGINT as total_coins,
    MAX(g.created_at) as last_gift
  FROM gifts g
  JOIN user_profiles up ON g.sender_id = up.id
  WHERE g.receiver_id = p_user_id
  GROUP BY g.sender_id, up.username, up.avatar_url
  ORDER BY total_coins DESC, last_gift DESC;
END;
$$;

-- Function to get user's gift recipients
CREATE OR REPLACE FUNCTION get_user_gift_recipients(p_user_id UUID)
RETURNS TABLE (
  recipient_id UUID,
  recipient_username TEXT,
  recipient_avatar_url TEXT,
  total_gifts_sent BIGINT,
  total_coins_sent BIGINT,
  last_gift_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.receiver_id,
    up.username,
    up.avatar_url,
    COUNT(*)::BIGINT as total_gifts,
    SUM(g.coins_spent)::BIGINT as total_coins,
    MAX(g.created_at) as last_gift
  FROM gifts g
  JOIN user_profiles up ON g.receiver_id = up.id
  WHERE g.sender_id = p_user_id
  GROUP BY g.receiver_id, up.username, up.avatar_url
  ORDER BY total_coins DESC, last_gift DESC;
END;
$$;

-- Function to check and pay for profile view
CREATE OR REPLACE FUNCTION pay_for_profile_view(
  p_viewer_id UUID,
  p_profile_owner_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_view_price INTEGER;
  v_viewer_balance INTEGER;
  v_has_access BOOLEAN;
BEGIN
  -- Get profile view price
  SELECT profile_view_price INTO v_view_price
  FROM user_profiles
  WHERE id = p_profile_owner_id;

  -- If no price or price is 0, access is free
  IF v_view_price IS NULL OR v_view_price <= 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'has_access', true,
      'message', 'Profile view is free'
    );
  END IF;

  -- Check if viewer already has access (stored in profile metadata or separate table)
  -- For now, we'll use a simple check - in production you might want a separate access table
  -- This is a simplified version - you may want to track access in a separate table

  -- Get viewer's paid coin balance
  SELECT paid_coin_balance INTO v_viewer_balance
  FROM user_profiles
  WHERE id = p_viewer_id;

  -- Check if viewer has enough coins
  IF v_viewer_balance < v_view_price THEN
    RETURN jsonb_build_object(
      'success', false,
      'has_access', false,
      'error', 'Insufficient paid coins',
      'required', v_view_price,
      'current_balance', v_viewer_balance
    );
  END IF;

  -- Deduct coins from viewer
  UPDATE user_profiles
  SET paid_coin_balance = paid_coin_balance - v_view_price
  WHERE id = p_viewer_id;

  -- Add coins to profile owner
  UPDATE user_profiles
  SET paid_coin_balance = paid_coin_balance + v_view_price
  WHERE id = p_profile_owner_id;

  -- Record transaction
  INSERT INTO coin_transactions (
    user_id,
    type,
    coins,
    amount_usd,
    description,
    metadata
  ) VALUES (
    p_viewer_id,
    'profile_view',
    -v_view_price,
    0,
    'Paid to view profile',
    jsonb_build_object('profile_owner_id', p_profile_owner_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'has_access', true,
    'paid', v_view_price,
    'message', 'Profile access granted'
  );
END;
$$;

-- Add comments count and gifts count to troll_posts for real-time updates
ALTER TABLE troll_posts 
  ADD COLUMN IF NOT EXISTS comments_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gifts_count INTEGER DEFAULT 0;

-- Function to update post engagement counts
CREATE OR REPLACE FUNCTION update_post_engagement_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'troll_post_comments' THEN
    UPDATE troll_posts
    SET comments_count = (
      SELECT COUNT(*) FROM troll_post_comments WHERE post_id = NEW.post_id
    )
    WHERE id = NEW.post_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger to update comment counts
DROP TRIGGER IF EXISTS update_post_comments_count ON troll_post_comments;
CREATE TRIGGER update_post_comments_count
  AFTER INSERT OR DELETE ON troll_post_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_post_engagement_counts();

COMMENT ON FUNCTION get_user_gifters IS 'Returns list of users who sent gifts to a specific user';
COMMENT ON FUNCTION get_user_gift_recipients IS 'Returns list of users who received gifts from a specific user';
COMMENT ON FUNCTION pay_for_profile_view IS 'Handles payment for viewing a profile with view price';

