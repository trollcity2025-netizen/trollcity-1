-- Add read_at column to conversation_messages if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversation_messages' AND column_name = 'read_at') THEN 
        ALTER TABLE "public"."conversation_messages" ADD COLUMN "read_at" timestamp with time zone; 
    END IF; 
END $$;

-- Drop existing functions to avoid signature conflicts
DROP FUNCTION IF EXISTS public.mark_conversation_read(uuid);
DROP FUNCTION IF EXISTS public.mark_conversation_read(uuid, uuid);

-- Create the function with 1 argument (compatible with client call)
CREATE OR REPLACE FUNCTION public.mark_conversation_read(
  conversation_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update read_at for messages in this conversation 
  -- sent by OTHER users (sender_id != auth.uid())
  -- that haven't been read yet
  UPDATE public.conversation_messages
  SET read_at = now()
  WHERE conversation_id = mark_conversation_read.conversation_id
    AND sender_id != auth.uid()
    AND read_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;
