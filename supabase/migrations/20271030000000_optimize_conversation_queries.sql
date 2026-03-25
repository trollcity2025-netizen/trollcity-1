-- Single RPC to get all conversation data in one query
-- Replaces 10+ separate queries from InboxSidebar, ChatWindow, ChatBubble

CREATE OR REPLACE FUNCTION public.get_user_conversations(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'conversation_id', c.conversation_id,
    'other_user_id', c.other_user_id,
    'other_username', c.other_username,
    'other_avatar_url', c.other_avatar_url,
    'other_created_at', c.other_created_at,
    'rgb_username_expires_at', c.rgb_username_expires_at,
    'glowing_username_color', c.glowing_username_color,
    'last_message', COALESCE(c.last_message, 'No messages yet'),
    'last_timestamp', COALESCE(c.last_timestamp::TEXT, ''),
    'unread_count', COALESCE(c.unread_count, 0)
  )), '[]'::JSONB) INTO v_result
  FROM public.get_user_conversations_optimized(p_user_id) c;

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_conversations(UUID) TO authenticated;

-- Also create a function to find a shared conversation between two users
CREATE OR REPLACE FUNCTION public.find_shared_conversation(p_user_id UUID, p_other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conversation_id UUID;
BEGIN
  SELECT cm1.conversation_id INTO v_conversation_id
  FROM public.conversation_members cm1
  INNER JOIN public.conversation_members cm2
    ON cm1.conversation_id = cm2.conversation_id
  WHERE cm1.user_id = p_user_id
    AND cm2.user_id = p_other_user_id
  LIMIT 1;

  RETURN v_conversation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_shared_conversation(UUID, UUID) TO authenticated;
