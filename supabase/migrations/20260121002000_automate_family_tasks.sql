-- Migration to automate family task generation and provide detailed weekly tasks

-- 1. Ensure family_tasks table exists with correct schema
CREATE TABLE IF NOT EXISTS public.family_tasks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    family_id uuid NOT NULL REFERENCES public.troll_families(id) ON DELETE CASCADE,
    task_title text NOT NULL,
    task_description text,
    reward_family_coins integer DEFAULT 0,
    reward_family_xp integer DEFAULT 0,
    goal_value integer DEFAULT 1,
    current_value integer DEFAULT 0,
    metric text NOT NULL,
    status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired')),
    expires_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Ensure columns exist (idempotent checks)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'family_tasks' AND column_name = 'task_title') THEN
        ALTER TABLE public.family_tasks ADD COLUMN task_title text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'family_tasks' AND column_name = 'metric') THEN
        ALTER TABLE public.family_tasks ADD COLUMN metric text;
    END IF;
    -- Add indexes if they don't exist
    CREATE INDEX IF NOT EXISTS idx_family_tasks_family_id ON public.family_tasks(family_id);
END $$;

-- 2. Create or Replace the create_family_tasks function
DROP FUNCTION IF EXISTS public.create_family_tasks(uuid);

CREATE OR REPLACE FUNCTION public.create_family_tasks(p_family_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_now timestamptz := now();
BEGIN
    -- Example: Insert a weekly cleaning task
    INSERT INTO public.family_tasks (family_id, task_title, task_description, reward_family_coins, reward_family_xp, goal_value, metric, status, expires_at, created_at, updated_at)
    VALUES (p_family_id, 'Weekly Cleaning', 'Clean the family house this week', 100, 10, 1, 'cleaning', 'active', v_now + interval '7 days', v_now, v_now);
END;
$$;
