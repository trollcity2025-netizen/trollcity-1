-- Optimized function to get user conversations in a single query
-- This replaces multiple queries in the application
CREATE OR REPLACE FUNCTION get_user_conversations_optimized(p_user_id UUID)
RETURNS TABLE (
  conversation_id UUID,
  other_user_id UUID,
  other_username TEXT,
  other_avatar_url TEXT,
  last_message TEXT,
  last_timestamp TIMESTAMPTZ,
  unread_count BIGINT,
  is_online BOOLEAN,
  rgb_username_expires_at TIMESTAMPTZ,
  glowing_username_color TEXT,
  other_created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH user_conversations AS (
    SELECT cm.conversation_id
    FROM conversation_members cm
    WHERE cm.user_id = p_user_id
  ),
  other_members AS (
    SELECT 
      cm.conversation_id,
      cm.user_id as other_user_id,
      up.username as other_username,
      up.avatar_url as other_avatar_url,
      up.rgb_username_expires_at,
      up.glowing_username_color,
      up.created_at as other_created_at
    FROM conversation_members cm
    JOIN user_profiles up ON cm.user_id = up.id
    WHERE cm.conversation_id IN (SELECT conversation_id FROM user_conversations)
      AND cm.user_id != p_user_id
  ),
  last_messages AS (
    SELECT 
      cm.conversation_id,
      cm.body as last_message,
      cm.created_at as last_timestamp
    FROM conversation_messages cm
    WHERE cm.conversation_id IN (SELECT conversation_id FROM user_conversations)
      AND cm.is_deleted = false
    ORDER BY cm.created_at DESC
    LIMIT 1
  ),
  unread_counts AS (
    SELECT 
      cm.conversation_id,
      COUNT(*)::BIGINT as unread_count
    FROM conversation_messages cm
    WHERE cm.conversation_id IN (SELECT conversation_id FROM user_conversations)
      AND cm.sender_id != p_user_id
      AND cm.read_at IS NULL
      AND cm.is_deleted = FALSE
    GROUP BY cm.conversation_id
  )
  SELECT 
    om.conversation_id,
    om.other_user_id,
    om.other_username,
    om.other_avatar_url,
    COALESCE(lm.last_message, 'No messages yet'::TEXT) as last_message,
    COALESCE(lm.last_timestamp, '1970-01-01'::TIMESTAMPTZ) as last_timestamp,
    COALESCE(uc.unread_count, 0::BIGINT) as unread_count,
    COALESCE(au.is_online, false) as is_online,
    om.rgb_username_expires_at,
    om.glowing_username_color,
    om.other_created_at
  FROM other_members om
  LEFT JOIN last_messages lm ON om.conversation_id = lm.conversation_id
  LEFT JOIN unread_counts uc ON om.conversation_id = uc.conversation_id
  LEFT JOIN active_users au ON om.other_user_id = au.user_id
  ORDER BY lm.last_timestamp DESC NULLS LAST;
END;
$$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_conversation_members_user ON conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_conversation ON conversation_members(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_read ON conversation_messages(conversation_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_conversation_messages_created ON conversation_messages(created_at DESC);
