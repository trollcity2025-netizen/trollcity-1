-- Fix potential constraint violation for coin_ledger direction check
-- This migration ensures the column exists, backfills data, and safely applies the constraint.


DO $$
BEGIN
    -- 1. Ensure direction column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coin_ledger' AND column_name = 'direction') THEN
        ALTER TABLE public.coin_ledger ADD COLUMN direction text;
    END IF;

    -- 2. Only backfill if delta column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coin_ledger' AND column_name = 'delta') THEN
        UPDATE public.coin_ledger
        SET direction = CASE 
            WHEN delta < 0 THEN 'out' 
            ELSE 'in' 
        END
        WHERE direction IS NULL;
    END IF;

    -- 3. Ensure constraint exists and is correct
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'coin_ledger_direction_check') THEN
        ALTER TABLE public.coin_ledger DROP CONSTRAINT coin_ledger_direction_check;
    END IF;

    ALTER TABLE public.coin_ledger
    ADD CONSTRAINT coin_ledger_direction_check
    CHECK (direction IN ('in', 'out'));
END $$;
