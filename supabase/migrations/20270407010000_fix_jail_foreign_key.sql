-- Fix jail table foreign key to user_profiles

DO $$
DECLARE
    v_fk_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'jail_user_id_fkey'
        AND table_name = 'jail'
    ) INTO v_fk_exists;
    
    IF NOT v_fk_exists THEN
        -- Delete orphaned jail records where user_id doesn't exist
        DELETE FROM public.jail 
        WHERE user_id IS NOT NULL 
        AND user_id NOT IN (SELECT id FROM public.user_profiles);
        
        -- Add foreign key constraint
        ALTER TABLE public.jail
        ADD CONSTRAINT jail_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
        
        RAISE NOTICE 'Added jail_user_id_fkey foreign key constraint';
    ELSE
        RAISE NOTICE 'jail_user_id_fkey already exists';
    END IF;
END $$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
    RAISE NOTICE 'Jail FK fix complete';
END $$;