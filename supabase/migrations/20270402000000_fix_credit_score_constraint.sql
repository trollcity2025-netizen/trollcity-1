-- Fix Credit Score Constraint
-- The credit_score column has a CHECK constraint limiting it to 0-100,
-- but the payment and loan systems expect scores up to 800.
-- This migration removes the old constraint and adds a new one with the correct range.

-- Drop the old constraint (if it exists)
DO $$
BEGIN
    -- Find and drop any existing credit_score check constraint
    IF EXISTS (
        SELECT 1 
        FROM information_schema.constraint_column_usage 
        WHERE table_name = 'user_profiles' 
        AND column_name = 'credit_score'
        AND constraint_name LIKE '%credit_score%check%'
    ) THEN
        EXECUTE (
            SELECT 'ALTER TABLE user_profiles DROP CONSTRAINT ' || constraint_name || ';'
            FROM information_schema.table_constraints
            WHERE table_name = 'user_profiles'
            AND constraint_type = 'CHECK'
            AND constraint_name LIKE '%credit_score%'
            LIMIT 1
        );
    END IF;
END $$;

-- Add new constraint with correct range (0 to 800)
ALTER TABLE public.user_profiles 
ADD CONSTRAINT user_profiles_credit_score_check 
CHECK (credit_score >= 0 AND credit_score <= 800);

-- Update any existing scores that are below 400 to the default 400
-- (since the rest of the system uses 400 as the starting score)
UPDATE public.user_profiles
SET credit_score = 400
WHERE credit_score < 400 AND credit_score IS NOT NULL;

-- Set NULL scores to 400
UPDATE public.user_profiles
SET credit_score = 400
WHERE credit_score IS NULL;
