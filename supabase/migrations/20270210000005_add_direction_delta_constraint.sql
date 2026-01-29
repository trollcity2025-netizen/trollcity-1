-- Fix coin_ledger direction column and add constraint to enforce delta-direction consistency
-- This migration ensures all existing rows have correct direction values and prevents future violations

DO $$
BEGIN
    -- 1. Backfill NULL direction values based on delta sign
    UPDATE public.coin_ledger
    SET direction = CASE 
        WHEN delta < 0 THEN 'out'
        ELSE 'in'
    END
    WHERE direction IS NULL;

    -- 2. Fix any mismatched direction values
    UPDATE public.coin_ledger
    SET direction = CASE 
        WHEN delta < 0 THEN 'out'
        ELSE 'in'
    END
    WHERE (delta < 0 AND direction = 'in')
       OR (delta >= 0 AND direction = 'out');

    -- 3. Drop the old constraint if it exists
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'coin_ledger_direction_matches_delta') THEN
        ALTER TABLE public.coin_ledger DROP CONSTRAINT coin_ledger_direction_matches_delta;
    END IF;

    -- 4. Add the constraint that direction matches delta sign
    -- delta > 0 means 'in' (coins coming in)
    -- delta < 0 means 'out' (coins going out)
    -- delta = 0 is allowed with either direction
    ALTER TABLE public.coin_ledger
    ADD CONSTRAINT coin_ledger_direction_matches_delta
    CHECK (
        (delta > 0 AND direction = 'in') OR
        (delta < 0 AND direction = 'out') OR
        (delta = 0 AND direction IN ('in', 'out'))
    );
END $$;
