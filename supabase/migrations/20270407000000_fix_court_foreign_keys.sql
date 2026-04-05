-- Fix court_cases table that only has case_id column - needs full schema

-- 1. Check if court_cases has only case_id column and needs restructuring
DO $$
DECLARE
    v_column_count INTEGER;
    v_has_id BOOLEAN;
BEGIN
    SELECT COUNT(*) INTO v_column_count
    FROM information_schema.columns
    WHERE table_name = 'court_cases' AND table_schema = 'public';
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'court_cases' AND table_schema = 'public' AND column_name = 'id'
    ) INTO v_has_id;
    
    RAISE NOTICE 'court_cases column count: %, has id: %', v_column_count, v_has_id;
    
    IF v_column_count = 1 AND NOT v_has_id THEN
        RAISE NOTICE 'court_cases table only has case_id, needs full schema';
    END IF;
END $$;

-- If the table only has case_id, rename it to id and add primary key
DO $$
DECLARE
    v_column_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_column_count
    FROM information_schema.columns
    WHERE table_name = 'court_cases' AND table_schema = 'public';
    
    IF v_column_count = 1 THEN
        -- Rename case_id to id
        ALTER TABLE public.court_cases RENAME COLUMN case_id TO id;
        
        -- Add primary key
        ALTER TABLE public.court_cases ADD PRIMARY KEY (id);
        
        -- Add missing columns
        ALTER TABLE public.court_cases ADD COLUMN IF NOT EXISTS docket_id UUID;
        ALTER TABLE public.court_cases ADD COLUMN IF NOT EXISTS plaintiff_id UUID;
        ALTER TABLE public.court_cases ADD COLUMN IF NOT EXISTS defendant_id UUID;
        ALTER TABLE public.court_cases ADD COLUMN IF NOT EXISTS reason TEXT;
        ALTER TABLE public.court_cases ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
        ALTER TABLE public.court_cases ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
        ALTER TABLE public.court_cases ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
        
        RAISE NOTICE 'Restructured court_cases table with proper schema';
    END IF;
END $$;

-- 2. Check court_summons structure
DO $$
DECLARE
    v_column_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_column_count
    FROM information_schema.columns
    WHERE table_name = 'court_summons' AND table_schema = 'public';
    
    RAISE NOTICE 'court_summons column count: %', v_column_count;
END $$;

-- 3. Now add foreign keys
DO $$
DECLARE
    v_fk_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'court_cases_docket_id_fkey'
        AND table_name = 'court_cases'
    ) INTO v_fk_exists;
    
    IF NOT v_fk_exists THEN
        ALTER TABLE public.court_cases
        ADD CONSTRAINT court_cases_docket_id_fkey
        FOREIGN KEY (docket_id) REFERENCES public.court_dockets(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
DECLARE
    v_fk_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'court_cases_defendant_id_fkey'
        AND table_name = 'court_cases'
    ) INTO v_fk_exists;
    
    IF NOT v_fk_exists THEN
        ALTER TABLE public.court_cases
        ADD CONSTRAINT court_cases_defendant_id_fkey
        FOREIGN KEY (defendant_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
DECLARE
    v_fk_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'court_cases_plaintiff_id_fkey'
        AND table_name = 'court_cases'
    ) INTO v_fk_exists;
    
    IF NOT v_fk_exists THEN
        ALTER TABLE public.court_cases
        ADD CONSTRAINT court_cases_plaintiff_id_fkey
        FOREIGN KEY (plaintiff_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
    RAISE NOTICE 'Court tables fixed successfully';
END $$;