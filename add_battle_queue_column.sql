-- Add battle_queue column to streams table for Trollmers auto-match system

-- Check if column exists first
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'streams' 
        AND column_name = 'battle_queue'
    ) THEN
        ALTER TABLE public.streams ADD COLUMN battle_queue BOOLEAN DEFAULT false;
        
        -- Create index for faster queries
        CREATE INDEX idx_streams_battle_queue ON public.streams(battle_queue) WHERE battle_queue = true;
        
        RAISE NOTICE 'Added battle_queue column to streams table';
    ELSE
        RAISE NOTICE 'battle_queue column already exists';
    END IF;
END $$;

-- Also ensure battle_id column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'streams' 
        AND column_name = 'battle_id'
    ) THEN
        ALTER TABLE public.streams ADD COLUMN battle_id UUID REFERENCES public.battles(id) ON DELETE SET NULL;
        CREATE INDEX idx_streams_battle_id ON public.streams(battle_id);
        RAISE NOTICE 'Added battle_id column to streams table';
    END IF;
END $$;

-- Ensure is_battle column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'streams' 
        AND column_name = 'is_battle'
    ) THEN
        ALTER TABLE public.streams ADD COLUMN is_battle BOOLEAN DEFAULT false;
        CREATE INDEX idx_streams_is_battle ON public.streams(is_battle) WHERE is_battle = true;
        RAISE NOTICE 'Added is_battle column to streams table';
    END IF;
END $$;
