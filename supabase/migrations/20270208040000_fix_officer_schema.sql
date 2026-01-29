-- Fix Officer Schema Mismatches

-- 1. Ensure last_activity exists on officer_work_sessions
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'officer_work_sessions' AND column_name = 'last_activity') THEN 
        ALTER TABLE "public"."officer_work_sessions" ADD COLUMN "last_activity" timestamptz DEFAULT now(); 
    END IF; 
END $$;

-- 2. Ensure auto_clocked_out exists on officer_work_sessions
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'officer_work_sessions' AND column_name = 'auto_clocked_out') THEN 
        ALTER TABLE "public"."officer_work_sessions" ADD COLUMN "auto_clocked_out" boolean DEFAULT false; 
    END IF; 
END $$;

-- 3. Ensure officer_shift_slots table exists (for scheduling)
CREATE TABLE IF NOT EXISTS public.officer_shift_slots (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    officer_id uuid REFERENCES public.user_profiles(id),
    shift_date date NOT NULL,
    shift_start_time time NOT NULL,
    shift_end_time time NOT NULL,
    status text CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')) DEFAULT 'scheduled',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS for officer_shift_slots
ALTER TABLE public.officer_shift_slots ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Officers can view own shift slots" ON public.officer_shift_slots;
    CREATE POLICY "Officers can view own shift slots" ON public.officer_shift_slots FOR SELECT USING (auth.uid() = officer_id);
    
    DROP POLICY IF EXISTS "Admins can manage all shift slots" ON public.officer_shift_slots;
    CREATE POLICY "Admins can manage all shift slots" ON public.officer_shift_slots FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true OR role = 'lead_troll_officer'))
    );
END $$;
