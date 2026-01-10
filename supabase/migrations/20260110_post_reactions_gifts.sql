-- Add replies, reactions, and gifts to troll wall posts and troll posts
-- Run this in your Supabase SQL Editor

-- ============================================================================
-- TROLL_WALL_POSTS (newer wall posts)
-- ============================================================================

-- 1. Add reply_to_post_id column to troll_wall_posts for threaded replies
ALTER TABLE troll_wall_posts ADD COLUMN IF NOT EXISTS reply_to_post_id UUID REFERENCES troll_wall_posts(id) ON DELETE SET NULL;

-- Index for efficient reply queries
CREATE INDEX IF NOT EXISTS idx_troll_wall_posts_reply_to ON troll_wall_posts(reply_to_post_id) WHERE reply_to_post_id IS NOT NULL;

-- 2. Create reactions table for emoji reactions on wall posts
CREATE TABLE IF NOT EXISTS troll_wall_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES troll_wall_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('love', 'haha', 'wow', 'sad', 'angry', 'fire', 'lol', 'clap', 'mindblown')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, user_id, reaction_type)
);

-- Indexes for reactions
CREATE INDEX IF NOT EXISTS idx_troll_wall_reactions_post_id ON troll_wall_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_troll_wall_reactions_user_id ON troll_wall_reactions(user_id);

-- 3. Create gifts table for sending gifts to wall posts
CREATE TABLE IF NOT EXISTS troll_wall_gifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES troll_wall_posts(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  gift_type TEXT NOT NULL CHECK (gift_type IN ('rose', 'heart', 'star', 'crown', 'diamond', 'trophy', 'coffee', 'pizza', 'rocket', 'dragon')),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  coin_cost BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for gifts
CREATE INDEX IF NOT EXISTS idx_troll_wall_gifts_post_id ON troll_wall_gifts(post_id);
CREATE INDEX IF NOT EXISTS idx_troll_wall_gifts_sender_id ON troll_wall_gifts(sender_id);

-- ============================================================================
-- TROLL_POSTS (older profile/timeline posts)
-- ============================================================================

-- 4. Add reply_to_post_id column to troll_posts for threaded replies
ALTER TABLE troll_posts ADD COLUMN IF NOT EXISTS reply_to_post_id UUID REFERENCES troll_posts(id) ON DELETE SET NULL;

-- Index for efficient reply queries
CREATE INDEX IF NOT EXISTS idx_troll_posts_reply_to ON troll_posts(reply_to_post_id) WHERE reply_to_post_id IS NOT NULL;

-- 5. Create reactions table for emoji reactions on profile posts
CREATE TABLE IF NOT EXISTS troll_post_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES troll_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('love', 'haha', 'wow', 'sad', 'angry', 'fire', 'lol', 'clap', 'mindblown')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, user_id, reaction_type)
);

-- Indexes for reactions
CREATE INDEX IF NOT EXISTS idx_troll_post_reactions_post_id ON troll_post_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_troll_post_reactions_user_id ON troll_post_reactions(user_id);

-- 6. Create gifts table for sending gifts to profile posts
CREATE TABLE IF NOT EXISTS troll_post_gifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES troll_posts(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  gift_type TEXT NOT NULL CHECK (gift_type IN ('rose', 'heart', 'star', 'crown', 'diamond', 'trophy', 'coffee', 'pizza', 'rocket', 'dragon')),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  coin_cost BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for gifts
CREATE INDEX IF NOT EXISTS idx_troll_post_gifts_post_id ON troll_post_gifts(post_id);
CREATE INDEX IF NOT EXISTS idx_troll_post_gifts_sender_id ON troll_post_gifts(sender_id);

-- ============================================================================
-- VIEWS AND FUNCTIONS FOR WALL POSTS
-- ============================================================================

-- 7. View to aggregate reactions by type for each wall post
CREATE OR REPLACE VIEW troll_wall_reactions_summary AS
SELECT 
  post_id,
  reaction_type,
  COUNT(*) as reaction_count
FROM troll_wall_reactions
GROUP BY post_id, reaction_type;

GRANT SELECT ON troll_wall_reactions_summary TO authenticated;

-- 8. View to show gift summary per wall post
CREATE OR REPLACE VIEW troll_wall_gifts_summary AS
SELECT 
  post_id,
  gift_type,
  SUM(quantity) as total_quantity,
  SUM(coin_cost) as total_coins
FROM troll_wall_gifts
GROUP BY post_id, gift_type;

GRANT SELECT ON troll_wall_gifts_summary TO authenticated;

-- 9. Function to toggle reaction on a wall post
CREATE OR REPLACE FUNCTION toggle_wall_post_reaction(
  p_post_id UUID,
  p_user_id UUID,
  p_reaction_type TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing BOOLEAN;
  v_reaction_count BIGINT;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM troll_wall_reactions
    WHERE post_id = p_post_id AND user_id = p_user_id AND reaction_type = p_reaction_type
  ) INTO v_existing;

  IF v_existing THEN
    DELETE FROM troll_wall_reactions
    WHERE post_id = p_post_id AND user_id = p_user_id AND reaction_type = p_reaction_type;
  ELSE
    DELETE FROM troll_wall_reactions
    WHERE post_id = p_post_id AND user_id = p_user_id;
    
    INSERT INTO troll_wall_reactions (post_id, user_id, reaction_type)
    VALUES (p_post_id, p_user_id, p_reaction_type);
  END IF;

  SELECT COUNT(*) INTO v_reaction_count
  FROM troll_wall_reactions
  WHERE post_id = p_post_id AND reaction_type = p_reaction_type;

  RETURN jsonb_build_object(
    'reaction_type', p_reaction_type,
    'removed', v_existing,
    'reaction_count', v_reaction_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION toggle_wall_post_reaction(UUID, UUID, TEXT) TO authenticated;

-- 10. Function to send a gift to a wall post
CREATE OR REPLACE FUNCTION send_wall_post_gift(
  p_post_id UUID,
  p_sender_id UUID,
  p_gift_type TEXT,
  p_quantity INTEGER DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gift_cost BIGINT;
  v_sender_coins BIGINT;
  v_post_owner_id UUID;
BEGIN
  SELECT coin_cost INTO v_gift_cost
  FROM gifts
  WHERE LOWER(name) = LOWER(p_gift_type)
  LIMIT 1;

  IF v_gift_cost IS NULL THEN
    v_gift_cost := 10;
  END IF;

  v_gift_cost := v_gift_cost * p_quantity;

  SELECT coins INTO v_sender_coins
  FROM user_profiles
  WHERE id = p_sender_id;

  IF v_sender_coins < v_gift_cost THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient coins',
      'required', v_gift_cost,
      'available', v_sender_coins
    );
  END IF;

  SELECT user_id INTO v_post_owner_id
  FROM troll_wall_posts
  WHERE id = p_post_id;

  IF v_post_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Post not found');
  END IF;

  UPDATE user_profiles SET coins = coins - v_gift_cost WHERE id = p_sender_id;
  UPDATE user_profiles SET coins = coins + (v_gift_cost * 0.8) WHERE id = v_post_owner_id;

  INSERT INTO troll_wall_gifts (post_id, sender_id, gift_type, quantity, coin_cost)
  VALUES (p_post_id, p_sender_id, p_gift_type, p_quantity, v_gift_cost);

  RETURN jsonb_build_object(
    'success', true,
    'gift_type', p_gift_type,
    'quantity', p_quantity,
    'total_cost', v_gift_cost,
    'sender_coins', v_sender_coins - v_gift_cost
  );
END;
$$;

GRANT EXECUTE ON FUNCTION send_wall_post_gift(UUID, UUID, TEXT, INTEGER) TO authenticated;

-- ============================================================================
-- VIEWS AND FUNCTIONS FOR PROFILE POSTS (troll_posts)
-- ============================================================================

-- 11. View to aggregate reactions by type for each profile post
CREATE OR REPLACE VIEW troll_post_reactions_summary AS
SELECT 
  post_id,
  reaction_type,
  COUNT(*) as reaction_count
FROM troll_post_reactions
GROUP BY post_id, reaction_type;

GRANT SELECT ON troll_post_reactions_summary TO authenticated;

-- 12. View to show gift summary per profile post
CREATE OR REPLACE VIEW troll_post_gifts_summary AS
SELECT 
  post_id,
  gift_type,
  SUM(quantity) as total_quantity,
  SUM(coin_cost) as total_coins
FROM troll_post_gifts
GROUP BY post_id, gift_type;

GRANT SELECT ON troll_post_gifts_summary TO authenticated;

-- 13. Function to toggle reaction on a profile post
CREATE OR REPLACE FUNCTION toggle_troll_post_reaction(
  p_post_id UUID,
  p_user_id UUID,
  p_reaction_type TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing BOOLEAN;
  v_reaction_count BIGINT;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM troll_post_reactions
    WHERE post_id = p_post_id AND user_id = p_user_id AND reaction_type = p_reaction_type
  ) INTO v_existing;

  IF v_existing THEN
    DELETE FROM troll_post_reactions
    WHERE post_id = p_post_id AND user_id = p_user_id AND reaction_type = p_reaction_type;
  ELSE
    DELETE FROM troll_post_reactions
    WHERE post_id = p_post_id AND user_id = p_user_id;
    
    INSERT INTO troll_post_reactions (post_id, user_id, reaction_type)
    VALUES (p_post_id, p_user_id, p_reaction_type);
  END IF;

  SELECT COUNT(*) INTO v_reaction_count
  FROM troll_post_reactions
  WHERE post_id = p_post_id AND reaction_type = p_reaction_type;

  RETURN jsonb_build_object(
    'reaction_type', p_reaction_type,
    'removed', v_existing,
    'reaction_count', v_reaction_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION toggle_troll_post_reaction(UUID, UUID, TEXT) TO authenticated;

-- 14. Function to send a gift to a profile post
CREATE OR REPLACE FUNCTION send_troll_post_gift(
  p_post_id UUID,
  p_sender_id UUID,
  p_gift_type TEXT,
  p_quantity INTEGER DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gift_cost BIGINT;
  v_sender_coins BIGINT;
  v_post_owner_id UUID;
BEGIN
  SELECT coin_cost INTO v_gift_cost
  FROM gifts
  WHERE LOWER(name) = LOWER(p_gift_type)
  LIMIT 1;

  IF v_gift_cost IS NULL THEN
    v_gift_cost := 10;
  END IF;

  v_gift_cost := v_gift_cost * p_quantity;

  SELECT coins INTO v_sender_coins
  FROM user_profiles
  WHERE id = p_sender_id;

  IF v_sender_coins < v_gift_cost THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient coins',
      'required', v_gift_cost,
      'available', v_sender_coins
    );
  END IF;

  SELECT user_id INTO v_post_owner_id
  FROM troll_posts
  WHERE id = p_post_id;

  IF v_post_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Post not found');
  END IF;

  UPDATE user_profiles SET coins = coins - v_gift_cost WHERE id = p_sender_id;
  UPDATE user_profiles SET coins = coins + (v_gift_cost * 0.8) WHERE id = v_post_owner_id;

  INSERT INTO troll_post_gifts (post_id, sender_id, gift_type, quantity, coin_cost)
  VALUES (p_post_id, p_sender_id, p_gift_type, p_quantity, v_gift_cost);

  RETURN jsonb_build_object(
    'success', true,
    'gift_type', p_gift_type,
    'quantity', p_quantity,
    'total_cost', v_gift_cost,
    'sender_coins', v_sender_coins - v_gift_cost
  );
END;
$$;

GRANT EXECUTE ON FUNCTION send_troll_post_gift(UUID, UUID, TEXT, INTEGER) TO authenticated;

-- 15. Function to create a reply post (for both tables)
CREATE OR REPLACE FUNCTION create_wall_post_reply(
  p_original_post_id UUID,
  p_user_id UUID,
  p_content TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_reply_id UUID;
BEGIN
  INSERT INTO troll_wall_posts (user_id, post_type, content, reply_to_post_id)
  VALUES (p_user_id, 'text', p_content, p_original_post_id)
  RETURNING id INTO v_reply_id;
  RETURN v_reply_id;
END;
$$;

CREATE OR REPLACE FUNCTION create_troll_post_reply(
  p_original_post_id UUID,
  p_user_id UUID,
  p_content TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_reply_id UUID;
BEGIN
  INSERT INTO troll_posts (user_id, content, reply_to_post_id)
  VALUES (p_user_id, p_content, p_original_post_id)
  RETURNING id INTO v_reply_id;
  RETURN v_reply_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_wall_post_reply(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_troll_post_reply(UUID, UUID, TEXT) TO authenticated;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Wall post reactions RLS
ALTER TABLE troll_wall_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view wall reactions" ON troll_wall_reactions FOR SELECT USING (true);
CREATE POLICY "Authenticated users can react to wall posts" ON troll_wall_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove their own wall reactions" ON troll_wall_reactions FOR DELETE USING (auth.uid() = user_id);

-- Wall post gifts RLS
ALTER TABLE troll_wall_gifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view wall gifts" ON troll_wall_gifts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can send wall gifts" ON troll_wall_gifts FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Profile post reactions RLS
ALTER TABLE troll_post_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view post reactions" ON troll_post_reactions FOR SELECT USING (true);
CREATE POLICY "Authenticated users can react to posts" ON troll_post_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove their own post reactions" ON troll_post_reactions FOR DELETE USING (auth.uid() = user_id);

-- Profile post gifts RLS
ALTER TABLE troll_post_gifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view post gifts" ON troll_post_gifts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can send post gifts" ON troll_post_gifts FOR INSERT WITH CHECK (auth.uid() = sender_id);
