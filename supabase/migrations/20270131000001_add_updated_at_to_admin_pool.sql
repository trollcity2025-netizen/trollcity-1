
DO $$
BEGIN
    -- Add updated_at if missing
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'admin_pool' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.admin_pool 
        ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- Add total_liability_coins if missing
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'admin_pool' 
        AND column_name = 'total_liability_coins'
    ) THEN
        ALTER TABLE public.admin_pool 
        ADD COLUMN total_liability_coins BIGINT DEFAULT 0;
    END IF;

    -- Add total_liability_usd if missing
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'admin_pool' 
        AND column_name = 'total_liability_usd'
    ) THEN
        ALTER TABLE public.admin_pool 
        ADD COLUMN total_liability_usd NUMERIC(18,2) DEFAULT 0;
    END IF;

    -- Add total_paid_usd if missing
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'admin_pool' 
        AND column_name = 'total_paid_usd'
    ) THEN
        ALTER TABLE public.admin_pool 
        ADD COLUMN total_paid_usd NUMERIC(18,2) DEFAULT 0;
    END IF;
END $$;
