-- Fix stream_messages RLS to allow everyone to see all messages
-- AND fix profile balance refresh after gift sending

-- Drop all existing policies on stream_messages (including new ones for idempotency)
DROP POLICY IF EXISTS "stream_messages_select_all" ON public.stream_messages;
DROP POLICY IF EXISTS "stream_messages_insert_own" ON public.stream_messages;
DROP POLICY IF EXISTS "stream_messages_delete_own" ON public.stream_messages;
DROP POLICY IF EXISTS "auth_select_own" ON public.stream_messages;
DROP POLICY IF EXISTS "auth_insert_own" ON public.stream_messages;
DROP POLICY IF EXISTS "auth_delete_own" ON public.stream_messages;
DROP POLICY IF EXISTS "auth_update_own" ON public.stream_messages;
DROP POLICY IF EXISTS "Users can send stream messages" ON public.stream_messages;
DROP POLICY IF EXISTS "Stream messages are viewable by everyone" ON public.stream_messages;
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.stream_messages;
DROP POLICY IF EXISTS "Public Read Stream Messages" ON public.stream_messages;
DROP POLICY IF EXISTS "Authenticated Insert Stream Messages" ON public.stream_messages;
DROP POLICY IF EXISTS "Broadcaster/Mod Delete Stream Messages" ON public.stream_messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON public.stream_messages;
DROP POLICY IF EXISTS "Broadcasters can delete messages in their stream" ON public.stream_messages;
DROP POLICY IF EXISTS "Moderators can delete messages" ON public.stream_messages;

-- Enable RLS
ALTER TABLE public.stream_messages ENABLE ROW LEVEL SECURITY;

-- Create clean policies
-- Everyone can read all messages (public chat)
CREATE POLICY "stream_messages_select_all" 
ON public.stream_messages
FOR SELECT
USING (true);

-- Authenticated users can insert messages
CREATE POLICY "stream_messages_insert_own" 
ON public.stream_messages
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Users can delete their own messages
CREATE POLICY "stream_messages_delete_own" 
ON public.stream_messages
FOR DELETE
USING (
  auth.uid() = user_id
  OR 
  -- Broadcaster can delete messages in their stream
  EXISTS (
    SELECT 1 FROM public.streams s
    WHERE s.id = stream_messages.stream_id 
    AND s.user_id = auth.uid()
  )
  OR
  -- Admins can delete any message
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() 
    AND up.role IN ('admin', 'superadmin')
  )
);

-- Create RPC function to post system messages
CREATE OR REPLACE FUNCTION public.post_system_message(
  p_stream_id UUID,
  p_user_id UUID,
  p_content TEXT,
  p_username TEXT,
  p_avatar_url TEXT DEFAULT NULL,
  p_role TEXT DEFAULT NULL,
  p_troll_role TEXT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.stream_messages (
    stream_id,
    user_id,
    content,
    type,
    user_name,
    user_avatar,
    user_role,
    user_troll_role
  ) VALUES (
    p_stream_id,
    p_user_id,
    p_content,
    'system',
    p_username,
    p_avatar_url,
    p_role,
    p_troll_role
  );
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_system_message(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
