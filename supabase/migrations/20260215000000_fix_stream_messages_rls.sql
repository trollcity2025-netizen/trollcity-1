-- Fix RLS for stream_messages to allow everyone to see all messages
-- This fixes the issue where livechat shows for user but not for everyone

-- Drop conflicting/restrictive policies that block public read access
DROP POLICY IF EXISTS "auth_select_own" ON public.stream_messages;
DROP POLICY IF EXISTS "deny_public_all" ON public.stream_messages;

-- Ensure RLS is enabled
ALTER TABLE public.stream_messages ENABLE ROW LEVEL SECURITY;

-- Create a clean public read policy (everyone can read all messages)
DROP POLICY IF EXISTS "stream_messages_public_read" ON public.stream_messages;
CREATE POLICY "stream_messages_public_read"
ON public.stream_messages
FOR SELECT
USING (true);

-- Create insert policy (users can only insert their own messages)
DROP POLICY IF EXISTS "stream_messages_insert_own" ON public.stream_messages;
CREATE POLICY "stream_messages_insert_own"
ON public.stream_messages
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create delete policy (users can delete their own messages, broadcaster can delete any)
DROP POLICY IF EXISTS "stream_messages_delete_own" ON public.stream_messages;
DROP POLICY IF EXISTS "stream_messages_delete_broadcaster" ON public.stream_messages;
CREATE POLICY "stream_messages_delete_own"
ON public.stream_messages
FOR DELETE
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.streams s
    WHERE s.id = stream_messages.stream_id
    AND s.user_id = auth.uid()
  )
);

-- Create update policy (users can update their own messages)
DROP POLICY IF EXISTS "stream_messages_update_own" ON public.stream_messages;
CREATE POLICY "stream_messages_update_own"
ON public.stream_messages
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Grant necessary permissions
GRANT SELECT ON public.stream_messages TO anon, authenticated;
GRANT INSERT ON public.stream_messages TO authenticated;
GRANT UPDATE ON public.stream_messages TO authenticated;
GRANT DELETE ON public.stream_messages TO authenticated;

-- Verify the policies are in place
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'stream_messages';
