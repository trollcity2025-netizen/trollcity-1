-- Add missing last_utility_paid_at column to leases
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leases'
          AND column_name = 'last_utility_paid_at'
    ) THEN
        ALTER TABLE public.leases ADD COLUMN last_utility_paid_at TIMESTAMPTZ;
    END IF;
END $$;
