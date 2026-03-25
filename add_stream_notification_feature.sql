-- ============================================================================
-- Stream Notification & Top Broadcaster Features
-- - Stream Notification: Send notification to followers when broadcaster goes live
-- - Top Broadcaster: Feature broadcaster in sidebar/homepage for 1 hour
-- ============================================================================

-- 1. Add broadcast notification columns to user_profiles if not exist
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS broadcast_notification_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS top_broadcaster_until TIMESTAMPTZ;

-- 2. Create function to activate broadcast notification (purchased feature)
CREATE OR REPLACE FUNCTION public.activate_broadcast_notification(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_username TEXT;
  v_stream_id UUID;
BEGIN
  -- Set notification expiry to 1 hour from now
  UPDATE user_profiles
  SET broadcast_notification_until = NOW() + INTERVAL '1 hour'
  WHERE id = p_user_id;

  -- Get username for notification
  SELECT username INTO v_username FROM user_profiles WHERE id = p_user_id;

  -- Get active stream if user is live
  SELECT id INTO v_stream_id FROM streams 
  WHERE broadcaster_id = p_user_id AND is_live = true AND status = 'live'
  LIMIT 1;

  -- Insert notification for followers
  -- This will be picked up by the notification system
  IF v_stream_id IS NOT NULL THEN
    INSERT INTO user_notifications (user_id, type, title, message, data)
    SELECT 
      follower_id,
      'stream_notification',
      v_username || ' is now live!',
      v_username || ' just started streaming. Tap to watch!',
      jsonb_build_object(
        'stream_id', v_stream_id,
        'broadcaster_id', p_user_id,
        'broadcaster_username', v_username
      )
    FROM user_followers
    WHERE following_id = p_user_id
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create function to activate top broadcaster feature (purchased feature)
CREATE OR REPLACE FUNCTION public.activate_top_broadcaster(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Set top broadcaster expiry to 1 hour from now
  UPDATE user_profiles
  SET top_broadcaster_until = NOW() + INTERVAL '1 hour'
  WHERE id = p_user_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create function to check if user has active broadcast notification
CREATE OR REPLACE FUNCTION public.has_active_broadcast_notification(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_until TIMESTAMPTZ;
BEGIN
  SELECT broadcast_notification_until INTO v_until
  FROM user_profiles
  WHERE id = p_user_id;

  RETURN v_until IS NOT NULL AND v_until > NOW();
END;
$$ LANGUAGE plpgsql STABLE;

-- 5. Create function to check if user has active top broadcaster feature
CREATE OR REPLACE FUNCTION public.has_active_top_broadcaster(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_until TIMESTAMPTZ;
BEGIN
  SELECT top_broadcaster_until INTO v_until
  FROM user_profiles
  WHERE id = p_user_id;

  RETURN v_until IS NOT NULL AND v_until > NOW();
END;
$$ LANGUAGE plpgsql STABLE;

-- 6. Create function to get users with active top broadcaster feature (for sidebar)
CREATE OR REPLACE FUNCTION public.get_top_broadcasters_with_featured()
RETURNS TABLE(
  user_id UUID,
  username TEXT,
  avatar_url TEXT,
  top_broadcaster_until TIMESTAMPTZ,
  is_live BOOLEAN,
  stream_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.id as user_id,
    up.username,
    up.avatar_url,
    up.top_broadcaster_until,
    CASE WHEN s.id IS NOT NULL THEN true ELSE false END as is_live,
    s.id as stream_id
  FROM user_profiles up
  LEFT JOIN streams s ON s.broadcaster_id = up.id AND s.is_live = true AND s.status = 'live'
  WHERE up.top_broadcaster_until IS NOT NULL AND up.top_broadcaster_until > NOW()
  ORDER BY up.top_broadcaster_until DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- 7. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.activate_broadcast_notification TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_top_broadcaster TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_broadcast_notification TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_top_broadcaster TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_broadcasters_with_featured TO authenticated, anon;