-- Troll City Wall - Social Feed / Bulletin Board
-- Table for storing wall posts

CREATE TABLE IF NOT EXISTS troll_wall_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  post_type TEXT NOT NULL CHECK (
    post_type IN (
      'text', 
      'stream_announce',
      'battle_result',
      'family_announce',
      'badge_earned',
      'system'
    )
  ),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  likes BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_troll_wall_posts_user_id ON troll_wall_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_troll_wall_posts_created_at ON troll_wall_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_troll_wall_posts_post_type ON troll_wall_posts(post_type);
CREATE INDEX IF NOT EXISTS idx_troll_wall_posts_likes ON troll_wall_posts(likes DESC);

-- Table for tracking user likes on posts (prevent double-liking)
CREATE TABLE IF NOT EXISTS troll_wall_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES troll_wall_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Indexes for likes
CREATE INDEX IF NOT EXISTS idx_troll_wall_likes_post_id ON troll_wall_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_troll_wall_likes_user_id ON troll_wall_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_troll_wall_likes_unique ON troll_wall_likes(post_id, user_id);

-- RLS Policies for troll_wall_posts
ALTER TABLE troll_wall_posts ENABLE ROW LEVEL SECURITY;

-- Everyone can view posts (public feed)
CREATE POLICY "Anyone can view wall posts"
  ON troll_wall_posts FOR SELECT
  USING (true);

-- Only authenticated users can create posts
CREATE POLICY "Authenticated users can create posts"
  ON troll_wall_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own posts
CREATE POLICY "Users can update their own posts"
  ON troll_wall_posts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own posts
CREATE POLICY "Users can delete their own posts"
  ON troll_wall_posts FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for troll_wall_likes
ALTER TABLE troll_wall_likes ENABLE ROW LEVEL SECURITY;

-- Everyone can view likes
CREATE POLICY "Anyone can view likes"
  ON troll_wall_likes FOR SELECT
  USING (true);

-- Only authenticated users can like posts
CREATE POLICY "Authenticated users can like posts"
  ON troll_wall_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can unlike their own likes
CREATE POLICY "Users can unlike posts"
  ON troll_wall_likes FOR DELETE
  USING (auth.uid() = user_id);

-- Function to toggle like on a post
CREATE OR REPLACE FUNCTION toggle_wall_post_like(
  p_post_id UUID,
  p_user_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_liked BOOLEAN;
  v_likes_count BIGINT;
BEGIN
  -- Check if user already liked this post
  SELECT EXISTS(
    SELECT 1 FROM troll_wall_likes
    WHERE post_id = p_post_id AND user_id = p_user_id
  ) INTO v_liked;

  IF v_liked THEN
    -- Unlike: remove like record
    DELETE FROM troll_wall_likes
    WHERE post_id = p_post_id AND user_id = p_user_id;
    
    -- Decrement likes count
    UPDATE troll_wall_posts
    SET likes = GREATEST(0, likes - 1)
    WHERE id = p_post_id;
    
    v_liked := false;
  ELSE
    -- Like: add like record
    INSERT INTO troll_wall_likes (post_id, user_id)
    VALUES (p_post_id, p_user_id)
    ON CONFLICT (post_id, user_id) DO NOTHING;
    
    -- Increment likes count
    UPDATE troll_wall_posts
    SET likes = likes + 1
    WHERE id = p_post_id;
    
    v_liked := true;
  END IF;

  -- Get updated likes count
  SELECT likes INTO v_likes_count
  FROM troll_wall_posts
  WHERE id = p_post_id;

  RETURN jsonb_build_object(
    'liked', v_liked,
    'likes_count', v_likes_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION toggle_wall_post_like(UUID, UUID) TO authenticated;

-- View for wall posts with user info
CREATE OR REPLACE VIEW troll_wall_posts_view AS
SELECT 
  p.id,
  p.user_id,
  up.username,
  up.avatar_url,
  up.is_admin,
  up.is_troll_officer,
  up.is_og_user,
  p.post_type,
  p.content,
  p.metadata,
  p.likes,
  p.created_at
FROM troll_wall_posts p
LEFT JOIN user_profiles up ON up.id = p.user_id
ORDER BY p.created_at DESC;

GRANT SELECT ON troll_wall_posts_view TO authenticated;

-- Function to check if user liked a post
CREATE OR REPLACE FUNCTION check_user_liked_post(
  p_post_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM troll_wall_likes
    WHERE post_id = p_post_id AND user_id = p_user_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION check_user_liked_post(UUID, UUID) TO authenticated;

-- Trigger: Auto-post when battle ends
CREATE OR REPLACE FUNCTION auto_post_battle_result()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host_username TEXT;
  v_challenger_username TEXT;
  v_winner_username TEXT;
  v_content TEXT;
BEGIN
  -- Only post when battle is completed
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Get usernames
    SELECT username INTO v_host_username
    FROM user_profiles
    WHERE id = NEW.host_id;
    
    SELECT username INTO v_challenger_username
    FROM user_profiles
    WHERE id = NEW.challenger_id;
    
    IF NEW.winner_id = NEW.host_id THEN
      v_winner_username := v_host_username;
    ELSE
      v_winner_username := v_challenger_username;
    END IF;
    
    v_content := format('⚔️ Battle Result: @%s defeated @%s! Total coins: %s', 
      v_winner_username,
      CASE WHEN NEW.winner_id = NEW.host_id THEN v_challenger_username ELSE v_host_username END,
      (NEW.host_total_coins + NEW.challenger_total_coins)::TEXT
    );
    
    -- Post as system (user_id = host_id for attribution, but mark as system type)
    INSERT INTO troll_wall_posts (user_id, post_type, content, metadata)
    VALUES (
      NEW.host_id,
      'battle_result',
      v_content,
      jsonb_build_object(
        'battle_id', NEW.id,
        'host_id', NEW.host_id,
        'challenger_id', NEW.challenger_id,
        'winner_id', NEW.winner_id,
        'host_total_coins', NEW.host_total_coins,
        'challenger_total_coins', NEW.challenger_total_coins
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Only create trigger if troll_battles table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'troll_battles') THEN
    DROP TRIGGER IF EXISTS trigger_auto_post_battle_result ON troll_battles;
    CREATE TRIGGER trigger_auto_post_battle_result
      AFTER UPDATE ON troll_battles
      FOR EACH ROW
      EXECUTE FUNCTION auto_post_battle_result();
  END IF;
END $$;

-- Trigger: Auto-post when badge is unlocked
CREATE OR REPLACE FUNCTION auto_post_badge_earned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_badge_name TEXT;
  v_username TEXT;
BEGIN
  -- Get badge name
  SELECT badge_name INTO v_badge_name
  FROM badges
  WHERE id = NEW.badge_id;
  
  -- Get username
  SELECT username INTO v_username
  FROM user_profiles
  WHERE id = NEW.user_id;
  
  -- Post badge announcement
  INSERT INTO troll_wall_posts (user_id, post_type, content, metadata)
  VALUES (
    NEW.user_id,
    'badge_earned',
    format('🏆 @%s unlocked the "%s" badge!', v_username, COALESCE(v_badge_name, 'Unknown Badge')),
    jsonb_build_object(
      'badge_id', NEW.badge_id,
      'earned_at', NEW.earned_at
    )
  );
  
  RETURN NEW;
END;
$$;

-- Only create trigger if user_badges table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_badges') THEN
    DROP TRIGGER IF EXISTS trigger_auto_post_badge_earned ON user_badges;
    CREATE TRIGGER trigger_auto_post_badge_earned
      AFTER INSERT ON user_badges
      FOR EACH ROW
      EXECUTE FUNCTION auto_post_badge_earned();
  END IF;
END $$;

-- Trigger: Auto-post when streamer goes live (optional - can be disabled)
CREATE OR REPLACE FUNCTION auto_post_stream_live()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username TEXT;
  v_stream_title TEXT;
BEGIN
  -- Only post when stream becomes live
  IF NEW.is_live = true AND (OLD.is_live IS NULL OR OLD.is_live = false) THEN
    -- Get broadcaster username
    SELECT username INTO v_username
    FROM user_profiles
    WHERE id = NEW.broadcaster_id;
    
    v_stream_title := COALESCE(NEW.title, 'Untitled Stream');
    
    -- Post stream announcement
    INSERT INTO troll_wall_posts (user_id, post_type, content, metadata)
    VALUES (
      NEW.broadcaster_id,
      'stream_announce',
      format('🔴 @%s is now LIVE: %s', v_username, v_stream_title),
      jsonb_build_object(
        'stream_id', NEW.id,
        'stream_title', v_stream_title
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Only create trigger if streams table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'streams') THEN
    DROP TRIGGER IF EXISTS trigger_auto_post_stream_live ON streams;
    -- Note: This trigger is optional - comment out if you don't want auto-posts for going live
    -- CREATE TRIGGER trigger_auto_post_stream_live
    --   AFTER UPDATE ON streams
    --   FOR EACH ROW
    --   EXECUTE FUNCTION auto_post_stream_live();
  END IF;
END $$;

