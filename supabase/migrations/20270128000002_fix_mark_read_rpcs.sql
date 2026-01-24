-- Fix for Error: 42P13: cannot change name of input parameter "p_message_id"
-- We need to drop the functions before recreating them with different parameter names

DROP FUNCTION IF EXISTS public.mark_message_read(uuid);
DROP FUNCTION IF EXISTS public.mark_conversation_read(uuid);

-- Fix/Ensure read_at column exists on conversation_messages 
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversation_messages' AND column_name = 'read_at') THEN 
        ALTER TABLE "public"."conversation_messages" ADD COLUMN "read_at" timestamp with time zone; 
    END IF; 
END $$; 

-- 1. mark_conversation_read 
CREATE OR REPLACE FUNCTION public.mark_conversation_read( 
  p_conversation_id uuid 
) 
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$ 
BEGIN 
  UPDATE public.conversation_messages 
  SET read_at = now() 
  WHERE conversation_id = p_conversation_id 
    AND sender_id != auth.uid() 
    AND read_at IS NULL; 
END; 
$$; 

GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated; 

-- 2. mark_message_read 
CREATE OR REPLACE FUNCTION public.mark_message_read( 
  message_id uuid 
) 
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$ 
BEGIN 
  UPDATE public.conversation_messages 
  SET read_at = now() 
  WHERE id = message_id 
    AND sender_id != auth.uid() 
    AND read_at IS NULL; 
END; 
$$; 

GRANT EXECUTE ON FUNCTION public.mark_message_read(uuid) TO authenticated;
