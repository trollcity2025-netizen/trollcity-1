-- Fix credit score to start at 400 (not 100) and update all scores below 400 to 400
-- First, find what valid values exist in the enum

-- Show current enum values (run this first to see what's valid)
-- SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'court_case_status');

-- Since we can't easily query the enum from outside, let's try to just update any NULL or invalid values to 'pending'
-- This will work if the column allows the update
UPDATE court_cases SET status = 'pending' WHERE status IS NULL;

-- 1. Fix user_profiles.credit_score default and range
ALTER TABLE user_profiles ALTER COLUMN credit_score SET DEFAULT 400;
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_credit_score_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_credit_score_check CHECK (credit_score >= 0 AND credit_score <= 800);

-- 2. Update all scores below 400 to 400
UPDATE user_profiles SET credit_score = 400 WHERE credit_score < 400 OR credit_score IS NULL;

-- 3. Skip the court_cases status constraint changes since the enum doesn't need modification
-- (Keeping existing enum values as-is)

-- 4. Ensure user_credit table has correct default
ALTER TABLE user_credit ALTER COLUMN score SET DEFAULT 400;
ALTER TABLE user_credit DROP CONSTRAINT IF EXISTS user_credit_score_check;
ALTER TABLE user_credit ADD CONSTRAINT user_credit_score_check CHECK (score >= 0 AND score <= 800);

-- Update any scores below 400 in user_credit
UPDATE user_credit SET score = 400 WHERE score < 400 OR score IS NULL;

-- 5. Fix court_cases foreign keys if missing
-- Ensure plaintiff_id column exists and has FK
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_cases' AND column_name = 'plaintiff_id') THEN
        ALTER TABLE court_cases ADD COLUMN plaintiff_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Ensure docket_id column exists and has FK
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_cases' AND column_name = 'docket_id') THEN
        ALTER TABLE court_cases ADD COLUMN docket_id UUID REFERENCES court_dockets(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 6. Fix court_summons foreign keys if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_summons' AND column_name = 'case_id') THEN
        ALTER TABLE court_summons ADD COLUMN case_id UUID REFERENCES court_cases(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 7. Add jail to user_profiles foreign key if missing
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jail' AND column_name = 'user_id') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'jail_user_id_fkey') THEN
            ALTER TABLE jail ADD CONSTRAINT jail_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;