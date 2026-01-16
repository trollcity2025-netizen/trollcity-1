-- XP System Migration

-- 1. Create user_stats table
CREATE TABLE IF NOT EXISTS public.user_stats (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    xp_total BIGINT DEFAULT 0,
    level INT DEFAULT 1,
    xp_to_next_level BIGINT DEFAULT 100,
    xp_progress FLOAT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create xp_ledger table
CREATE TABLE IF NOT EXISTS public.xp_ledger (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    source_id TEXT NOT NULL, -- Unique per source
    xp_amount BIGINT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source, source_id)
);

-- 3. Enable RLS
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_ledger ENABLE ROW LEVEL SECURITY;

-- 4. Policies
-- user_stats: Users can view their own stats. System updates them.
CREATE POLICY "Users can view own stats" ON public.user_stats
    FOR SELECT USING (auth.uid() = user_id);

-- xp_ledger: Users can view their own ledger.
CREATE POLICY "Users can view own ledger" ON public.xp_ledger
    FOR SELECT USING (auth.uid() = user_id);

-- 5. Helper function to compute level (Deterministic)
-- Level 1: 0-100 XP
-- Level 2: 101-300 XP (Next 200)
-- Level 3: 301-600 XP (Next 300)
-- Formula: Level N requires N * 100 XP more than previous? Or simple curve.
-- Let's use a simple formula: level = floor(sqrt(xp_total / 100)) + 1
-- Or strict table lookups. Let's use the one requested: "Level 1 starts at 0 XP. XP requirement increases gradually."
CREATE OR REPLACE FUNCTION calculate_level(xp BIGINT) 
RETURNS TABLE (lvl INT, xp_next BIGINT, progress FLOAT) AS $$
DECLARE
    l INT := 1;
    req BIGINT := 100;
    prev_req BIGINT := 0;
    cur_xp BIGINT := xp;
BEGIN
    -- Simple linear growth for requirements: 100, 200, 300, 400...
    -- Cumulative: 100, 300, 600, 1000...
    LOOP
        IF cur_xp < req THEN
            EXIT;
        END IF;
        l := l + 1;
        prev_req := req;
        req := req + (l * 100); -- Next level needs L*100 more
    END LOOP;
    
    lvl := l;
    xp_next := req;
    progress := (cur_xp - prev_req)::FLOAT / (req - prev_req)::FLOAT;
    
    RETURN QUERY SELECT lvl, xp_next, progress;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 6. grant_xp RPC
CREATE OR REPLACE FUNCTION grant_xp(
    p_user_id UUID,
    p_amount BIGINT,
    p_source TEXT,
    p_source_id TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB AS $$
DECLARE
    new_total BIGINT;
    new_level INT;
    new_next BIGINT;
    new_prog FLOAT;
    current_stats RECORD;
BEGIN
    -- Check deduplication
    IF EXISTS (SELECT 1 FROM public.xp_ledger WHERE source = p_source AND source_id = p_source_id) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Duplicate source_id');
    END IF;

    -- Insert into ledger
    INSERT INTO public.xp_ledger (user_id, source, source_id, xp_amount, metadata)
    VALUES (p_user_id, p_source, p_source_id, p_amount, p_metadata);

    -- Get current stats or init
    INSERT INTO public.user_stats (user_id, xp_total)
    VALUES (p_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;

    -- Update stats atomically
    UPDATE public.user_stats
    SET xp_total = xp_total + p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING xp_total INTO new_total;

    -- Recalculate level
    SELECT lvl, xp_next, progress INTO new_level, new_next, new_prog
    FROM calculate_level(new_total);

    UPDATE public.user_stats
    SET level = new_level,
        xp_to_next_level = new_next,
        xp_progress = new_prog
    WHERE user_id = p_user_id;

    -- Return result
    RETURN jsonb_build_object(
        'success', true,
        'user_id', p_user_id,
        'xp_total', new_total,
        'level', new_level,
        'xp_added', p_amount
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
