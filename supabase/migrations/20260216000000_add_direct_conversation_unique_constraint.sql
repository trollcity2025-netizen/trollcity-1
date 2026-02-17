-- Migration: Add unique constraint for direct conversations
-- This prevents creating multiple DM threads between the same two users

-- 1. Add conversation type column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'type') THEN 
        ALTER TABLE "public"."conversations" ADD COLUMN "type" TEXT DEFAULT 'direct' CHECK (type IN ('direct', 'group'));
    END IF; 
END $$;

-- 2. Create helper function to generate direct conversation key (sorted user pair)
CREATE OR REPLACE FUNCTION public.get_direct_conv_key(user_id_1 uuid, user_id_2 uuid)
RETURNS TEXT
IMMUTABLE
LANGUAGE sql
AS $$
  SELECT CASE 
    WHEN user_id_1 < user_id_2 THEN user_id_1::text || '|' || user_id_2::text
    ELSE user_id_2::text || '|' || user_id_1::text
  END;
$$;

-- 3. Add direct_conversation_key column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'direct_conversation_key') THEN 
        ALTER TABLE "public"."conversations" ADD COLUMN "direct_conversation_key" TEXT;
    END IF; 
END $$;

-- 4. Backfill direct_conversation_key for existing direct conversations
UPDATE public.conversations c
SET direct_conversation_key = public.get_direct_conv_key(
  (SELECT u1.user_id FROM public.conversation_members u1 WHERE u1.conversation_id = c.id ORDER BY u1.user_id ASC LIMIT 1),
  (SELECT u2.user_id FROM public.conversation_members u2 WHERE u2.conversation_id = c.id ORDER BY u2.user_id DESC LIMIT 1)
)
WHERE c.type = 'direct' 
  AND c.direct_conversation_key IS NULL
  AND (SELECT COUNT(*) FROM public.conversation_members WHERE conversation_id = c.id) = 2;

-- 5. Create unique constraint on direct_conversation_key for direct conversations
-- This prevents multiple threads with the same two users
-- PostgreSQL: Use CREATE UNIQUE INDEX with WHERE clause for partial uniqueness
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics 
    WHERE schemaname = 'public' 
    AND tablename = 'conversations' 
    AND indexname = 'ux_direct_conversation_key'
  ) THEN
    CREATE UNIQUE INDEX ux_direct_conversation_key 
    ON public.conversations(direct_conversation_key) 
    WHERE type = 'direct';
  END IF;
END $$;
