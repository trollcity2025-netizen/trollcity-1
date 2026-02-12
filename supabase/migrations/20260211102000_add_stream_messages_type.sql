-- Add missing type column to stream_messages if it doesn't exist

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'stream_messages' 
        AND column_name = 'type'
    ) THEN
        ALTER TABLE public.stream_messages 
        ADD COLUMN type TEXT DEFAULT 'chat';
    END IF;
END $$;
