-- Fix for PGRST200: Could not find a relationship between 'jail' and 'user_profiles'
-- This migration ensures the jail table exists and has a proper foreign key relationship with user_profiles.

-- 1. Create jail table if it doesn't exist (in case it was only created in the DB directly)
CREATE TABLE IF NOT EXISTS public.jail (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    release_time timestamptz NOT NULL,
    reason text,
    created_at timestamptz DEFAULT now()
);

-- 2. Ensure the foreign key relationship exists so PostgREST can detect it for joins
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'jail_user_id_fkey'
        AND table_name = 'jail'
    ) THEN
        ALTER TABLE public.jail
        ADD CONSTRAINT jail_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.user_profiles(id)
        ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Enable RLS if not already enabled
ALTER TABLE public.jail ENABLE ROW LEVEL SECURITY;

-- 4. Re-create policies to ensure they are correct
DROP POLICY IF EXISTS "Anyone can view jail status" ON public.jail;
CREATE POLICY "Anyone can view jail status" ON public.jail FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins and officers can manage jail" ON public.jail;
CREATE POLICY "Admins and officers can manage jail" ON public.jail FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid()
        AND (is_admin = true OR role = 'admin' OR is_troll_officer = true OR role = 'troll_officer' OR is_lead_officer = true OR role = 'lead_troll_officer')
    )
);

-- 5. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_jail_user_id ON public.jail(user_id);
CREATE INDEX IF NOT EXISTS idx_jail_release_time ON public.jail(release_time);
