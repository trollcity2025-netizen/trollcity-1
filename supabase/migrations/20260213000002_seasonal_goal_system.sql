-- Seasonal Goal System Migration

-- 1. Seasons and Tasks Configuration
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_metric_type') THEN
        CREATE TYPE public.task_metric_type AS ENUM (
            'live_minutes',
            'live_sessions',
            'chat_messages',
            'unique_gifters',
            'returning_gifters',
            'no_strikes',
            'no_fraud'
        );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_cadence') THEN
        CREATE TYPE public.task_cadence AS ENUM ('daily', 'weekly', 'monthly');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.task_seasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_dates CHECK (end_date > start_date)
);

CREATE TABLE IF NOT EXISTS public.task_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric task_metric_type NOT NULL,
    cadence task_cadence NOT NULL,
    default_threshold INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.season_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID NOT NULL REFERENCES public.task_seasons(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES public.task_templates(id),
    threshold INTEGER NOT NULL,
    bonus_points INTEGER DEFAULT 0, -- Extra weight if we want multi-level bonuses later
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Weekly Payout Batches
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payout_batch_status') THEN
        CREATE TYPE public.payout_batch_status AS ENUM ('open', 'locked', 'processing', 'completed', 'cancelled');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.payout_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_start DATE NOT NULL, -- Usually Monday
    week_end DATE NOT NULL,   -- Usually Sunday
    payout_date DATE NOT NULL, -- The Friday of that week
    status payout_batch_status DEFAULT 'open',
    total_amount BIGINT DEFAULT 0,
    request_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Creator Daily Stats (Caching for Performance)
CREATE TABLE IF NOT EXISTS public.creator_daily_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    stat_date DATE NOT NULL,
    live_minutes INTEGER DEFAULT 0,
    live_sessions INTEGER DEFAULT 0,
    chat_messages INTEGER DEFAULT 0,
    unique_gifters INTEGER DEFAULT 0,
    returning_gifters INTEGER DEFAULT 0,
    has_strikes BOOLEAN DEFAULT false,
    has_fraud BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, stat_date)
);

-- 4. Creator Goal Boost (Help Requests)
CREATE TABLE IF NOT EXISTS public.creator_goal_boost (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    batch_id UUID REFERENCES public.payout_batches(id),
    help_text TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Payout Requests Integration
ALTER TABLE public.payout_requests 
ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.payout_batches(id),
ADD COLUMN IF NOT EXISTS bonus_applied BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS bonus_amount BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS net_amount NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS eligibility_snapshot JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS processed_by UUID REFERENCES public.user_profiles(id),
ADD COLUMN IF NOT EXISTS payment_reference TEXT;

-- 6. Helper Functions

-- Function to get unique gifters for a creator in a date range
CREATE OR REPLACE FUNCTION public.get_unique_gifters_count(
    p_user_id UUID,
    p_start_date DATE,
    p_end_date DATE
) RETURNS INTEGER AS $$
    SELECT COUNT(DISTINCT sender_id)::INTEGER
    FROM public.gifts
    WHERE receiver_id = p_user_id
    AND created_at::DATE >= p_start_date
    AND created_at::DATE <= p_end_date;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Function to get returning gifters count (gifters who gifted in previous 30 days)
CREATE OR REPLACE FUNCTION public.get_returning_gifters_count(
    p_user_id UUID,
    p_start_date DATE,
    p_end_date DATE
) RETURNS INTEGER AS $$
    WITH current_gifters AS (
        SELECT DISTINCT sender_id
        FROM public.gifts
        WHERE receiver_id = p_user_id
        AND created_at::DATE >= p_start_date
        AND created_at::DATE <= p_end_date
    ),
    previous_gifters AS (
        SELECT DISTINCT sender_id
        FROM public.gifts
        WHERE receiver_id = p_user_id
        AND created_at::DATE < p_start_date
        AND created_at::DATE >= (p_start_date - INTERVAL '30 days')
    )
    SELECT COUNT(*)::INTEGER
    FROM current_gifters c
    JOIN previous_gifters p ON c.sender_id = p.sender_id;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- 7. Eligibility Logic
CREATE OR REPLACE FUNCTION public.check_creator_weekly_eligibility(
    p_user_id UUID,
    p_batch_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_batch RECORD;
    v_season RECORD;
    v_task RECORD;
    v_stats RECORD;
    v_is_eligible BOOLEAN := true;
    v_details JSONB := '{}'::jsonb;
    v_metric_val INTEGER;
    v_task_met BOOLEAN;
BEGIN
    -- Get batch info
    SELECT * INTO v_batch FROM public.payout_batches WHERE id = p_batch_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('eligible', false, 'reason', 'Batch not found'); END IF;

    -- Get active season
    SELECT * INTO v_season FROM public.task_seasons 
    WHERE is_active = true 
    AND start_date <= v_batch.week_start 
    AND end_date >= v_batch.week_end;
    
    IF NOT FOUND THEN RETURN jsonb_build_object('eligible', false, 'reason', 'No active season for this period'); END IF;

    -- Aggregated stats for the week
    SELECT 
        SUM(live_minutes) as live_minutes,
        SUM(live_sessions) as live_sessions,
        SUM(chat_messages) as chat_messages,
        MAX(has_strikes::int)::boolean as has_strikes,
        MAX(has_fraud::int)::boolean as has_fraud
    INTO v_stats
    FROM public.creator_daily_stats
    WHERE user_id = p_user_id 
    AND stat_date >= v_batch.week_start 
    AND stat_date <= v_batch.week_end;

    -- Gifter stats (calculated on demand for accuracy)
    v_stats.unique_gifters := public.get_unique_gifters_count(p_user_id, v_batch.week_start, v_batch.week_end);
    v_stats.returning_gifters := public.get_returning_gifters_count(p_user_id, v_batch.week_start, v_batch.week_end);

    -- Check each task in the season
    FOR v_task IN 
        SELECT st.*, tt.metric, tt.cadence 
        FROM public.season_tasks st
        JOIN public.task_templates tt ON st.template_id = tt.id
        WHERE st.season_id = v_season.id
    LOOP
        -- Map metric to stat
        CASE v_task.metric
            WHEN 'live_minutes' THEN v_metric_val := COALESCE(v_stats.live_minutes, 0);
            WHEN 'live_sessions' THEN v_metric_val := COALESCE(v_stats.live_sessions, 0);
            WHEN 'chat_messages' THEN v_metric_val := COALESCE(v_stats.chat_messages, 0);
            WHEN 'unique_gifters' THEN v_metric_val := COALESCE(v_stats.unique_gifters, 0);
            WHEN 'returning_gifters' THEN v_metric_val := COALESCE(v_stats.returning_gifters, 0);
            WHEN 'no_strikes' THEN v_metric_val := CASE WHEN v_stats.has_strikes THEN 0 ELSE 1 END;
            WHEN 'no_fraud' THEN v_metric_val := CASE WHEN v_stats.has_fraud THEN 0 ELSE 1 END;
            ELSE v_metric_val := 0;
        END CASE;

        v_task_met := v_metric_val >= v_task.threshold;
        
        IF NOT v_task_met THEN
            v_is_eligible := false;
        END IF;

        v_details := v_details || jsonb_build_object(
            v_task.metric::text, 
            jsonb_build_object(
                'current', v_metric_val, 
                'threshold', v_task.threshold, 
                'met', v_task_met
            )
        );
    END LOOP;

    RETURN jsonb_build_object(
        'eligible', v_is_eligible,
        'season_name', v_season.name,
        'metrics', v_details
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 8. Row Level Security
ALTER TABLE public.task_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_goal_boost ENABLE ROW LEVEL SECURITY;

-- Policies for Admins (Assuming 'admin' role or is_admin flag in user_profiles)
-- For now, using a placeholder check.
DROP POLICY IF EXISTS "Admin full access to seasons" ON public.task_seasons;
CREATE POLICY "Admin full access to seasons" ON public.task_seasons FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true))
);

DROP POLICY IF EXISTS "Public read active seasons" ON public.task_seasons;
CREATE POLICY "Public read active seasons" ON public.task_seasons FOR SELECT TO authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Admin full access to templates" ON public.task_templates;
CREATE POLICY "Admin full access to templates" ON public.task_templates FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true))
);

DROP POLICY IF EXISTS "Admin full access to season tasks" ON public.season_tasks;
CREATE POLICY "Admin full access to season tasks" ON public.season_tasks FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true))
);

DROP POLICY IF EXISTS "Admin full access to batches" ON public.payout_batches;
CREATE POLICY "Admin full access to batches" ON public.payout_batches FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true OR role = 'secretary'))
);

DROP POLICY IF EXISTS "Creators can see their own stats" ON public.creator_daily_stats;
CREATE POLICY "Creators can see their own stats" ON public.creator_daily_stats FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Creators can see their own boosts" ON public.creator_goal_boost;
CREATE POLICY "Creators can see their own boosts" ON public.creator_goal_boost FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Creators can insert their own boosts" ON public.creator_goal_boost;
CREATE POLICY "Creators can insert their own boosts" ON public.creator_goal_boost FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- 9. Automatic Daily Stats Update Trigger (Conceptual - would need real events)
-- In a real system, we'd have triggers on gifts, live_sessions, etc.
-- For this implementation, we'll provide a manual refresh RPC for creators.

CREATE OR REPLACE FUNCTION public.refresh_my_daily_stats(p_date DATE) 
RETURNS VOID AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    INSERT INTO public.creator_daily_stats (user_id, stat_date, live_minutes, live_sessions, unique_gifters, returning_gifters)
    SELECT 
        v_user_id,
        p_date,
        (SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (updated_at - created_at))/60), 0) FROM public.live_sessions WHERE user_id = v_user_id AND created_at::DATE = p_date),
        (SELECT COUNT(*) FROM public.live_sessions WHERE user_id = v_user_id AND created_at::DATE = p_date),
        public.get_unique_gifters_count(v_user_id, p_date, p_date),
        public.get_returning_gifters_count(v_user_id, p_date, p_date)
    ON CONFLICT (user_id, stat_date) DO UPDATE SET
        live_minutes = EXCLUDED.live_minutes,
        live_sessions = EXCLUDED.live_sessions,
        unique_gifters = EXCLUDED.unique_gifters,
        returning_gifters = EXCLUDED.returning_gifters,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Payout Request and Batching Functions

-- Function to get or create the current week's batch
CREATE OR REPLACE FUNCTION public.get_current_payout_batch()
RETURNS UUID AS $$
DECLARE
    v_batch_id UUID;
    v_week_start DATE := date_trunc('week', NOW())::DATE; -- Monday
    v_week_end DATE := (v_week_start + INTERVAL '6 days')::DATE; -- Sunday
    v_payout_date DATE := (v_week_start + INTERVAL '4 days')::DATE; -- Friday
BEGIN
    SELECT id INTO v_batch_id 
    FROM public.payout_batches 
    WHERE week_start = v_week_start AND status = 'open';

    IF v_batch_id IS NULL THEN
        INSERT INTO public.payout_batches (week_start, week_end, payout_date, status)
        VALUES (v_week_start, v_week_end, v_payout_date, 'open')
        RETURNING id INTO v_batch_id;
    END IF;

    RETURN v_batch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to request a payout with bonus check
CREATE OR REPLACE FUNCTION public.request_payout(
    p_tier_id UUID,
    p_coin_amount BIGINT,
    p_cash_amount NUMERIC,
    p_currency TEXT DEFAULT 'USD'
) RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_batch_id UUID;
    v_eligibility JSONB;
    v_bonus_amount BIGINT := 0;
    v_bonus_applied BOOLEAN := false;
    v_payout_id UUID;
    v_user_balance BIGINT;
    v_user_reserved BIGINT;
    v_paypal_email TEXT;
BEGIN
    -- Get current batch
    v_batch_id := public.get_current_payout_batch();

    -- Check balance and payout method
    SELECT troll_coins, COALESCE(reserved_troll_coins, 0), payout_paypal_email
    INTO v_user_balance, v_user_reserved, v_paypal_email
    FROM public.user_profiles 
    WHERE id = v_user_id;

    IF v_paypal_email IS NULL OR v_paypal_email = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Please set your PayPal email in settings first');
    END IF;

    IF v_user_balance - v_user_reserved < p_coin_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
    END IF;

    -- Check weekly eligibility for bonus
    v_eligibility := public.check_creator_weekly_eligibility(v_user_id, v_batch_id);
    
    IF (v_eligibility->>'eligible')::BOOLEAN THEN
        v_bonus_applied := true;
        v_bonus_amount := FLOOR(p_cash_amount * 0.025 * 100); -- 2.5% bonus in cents (assuming cash_amount is dollars)
        -- Wait, the bonus is +2.5% of the payout. If payout is $100, bonus is $2.50.
    END IF;

    -- Insert payout request
    INSERT INTO public.payout_requests (
        user_id,
        coin_amount,
        cash_amount,
        currency,
        status,
        batch_id,
        bonus_applied,
        bonus_amount,
        eligibility_snapshot,
        net_amount
    ) VALUES (
        v_user_id,
        p_coin_amount,
        p_cash_amount,
        p_currency,
        'pending',
        v_batch_id,
        v_bonus_applied,
        v_bonus_amount / 100.0, -- Store in dollars
        v_eligibility,
        p_cash_amount + (v_bonus_amount / 100.0)
    ) RETURNING id INTO v_payout_id;

    -- Reserve coins
    UPDATE public.user_profiles 
    SET reserved_troll_coins = v_user_reserved + p_coin_amount
    WHERE id = v_user_id;

    RETURN jsonb_build_object(
        'success', true, 
        'payout_id', v_payout_id, 
        'bonus_applied', v_bonus_applied,
        'bonus_amount', v_bonus_amount / 100.0
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
