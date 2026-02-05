-- Ensure stream_gifts table has recipient_id column
-- This fixes "column stream_gifts.recipient_id does not exist" error

DO $$
BEGIN
    -- Check if recipient_id exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'stream_gifts' 
        AND column_name = 'recipient_id'
    ) THEN
        ALTER TABLE public.stream_gifts ADD COLUMN recipient_id UUID REFERENCES auth.users(id);
    END IF;

    -- Check if receiver_id exists (as alias/fallback)
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'stream_gifts' 
        AND column_name = 'receiver_id'
    ) THEN
        ALTER TABLE public.stream_gifts ADD COLUMN receiver_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- Create index for performance if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_stream_gifts_recipient ON public.stream_gifts(recipient_id);
CREATE INDEX IF NOT EXISTS idx_stream_gifts_receiver ON public.stream_gifts(receiver_id);
