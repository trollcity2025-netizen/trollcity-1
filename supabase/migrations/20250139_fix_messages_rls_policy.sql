-- Fix messages RLS policy to allow inserts with sender_id
-- The current policy checks user_id, but code uses sender_id for direct messages

-- Drop the old policy
DROP POLICY IF EXISTS "messages_insert_self" ON messages;

-- Create new policy that checks sender_id instead of user_id
-- This allows inserts where sender_id = auth.uid() (for direct messages)
-- OR user_id = auth.uid() (for stream messages)
CREATE POLICY "messages_insert_self" 
ON messages 
FOR INSERT 
TO authenticated 
WITH CHECK (
  sender_id = auth.uid() OR 
  user_id = auth.uid() OR
  (sender_id IS NULL AND user_id = auth.uid())
);

COMMENT ON POLICY "messages_insert_self" ON messages IS 'Users can insert messages where they are the sender (sender_id) or the user (user_id)';

