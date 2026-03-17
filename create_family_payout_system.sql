-- =============================================================================
-- FAMILY EARNINGS & PAYOUT DISTRIBUTION SYSTEM
-- Family coin pool with weekly distributions and leader tax
-- =============================================================================

-- =============================================================================
-- FAMILY EARNINGS POOL TABLE
-- Tracks total family earnings from tasks/goals
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.family_earnings_pool (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID UNIQUE REFERENCES public.troll_families(id) ON DELETE CASCADE,
    
    -- Total earnings from all sources
    total_earned BIGINT DEFAULT 0,
    weekly_earned BIGINT DEFAULT 0,
    monthly_earned BIGINT DEFAULT 0,
    
    -- Available for distribution
    available_balance BIGINT DEFAULT 0,
    pending_distribution BIGINT DEFAULT 0,
    
    -- Distribution tracking
    last_distribution_at TIMESTAMPTZ,
    last_reset_at TIMESTAMPTZ,
    
    -- Weekly completion tracking
    current_week_completed BOOLEAN DEFAULT false,
    current_week_goals INTEGER DEFAULT 0,
    current_week_total_goals INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_family_earnings_pool_family ON public.family_earnings_pool(family_id);

-- =============================================================================
-- FAMILY MEMBER EARNINGS TABLE
-- Tracks each member's earnings and leader tax
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.family_member_earnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES public.troll_families(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    
    -- Earnings tracking
    total_earned BIGINT DEFAULT 0,
    monthly_earned BIGINT DEFAULT 0,
    pending_payout BIGINT DEFAULT 0,
    last_paid_payout BIGINT DEFAULT 0,
    
    -- Leader tax tracking
    leader_tax_collected BIGINT DEFAULT 0,
    leader_tax_paid BOOLEAN DEFAULT false,
    tax_month INTEGER,
    tax_year INTEGER,
    
    -- Monthly tracking
    month INTEGER,
    year INTEGER,
    
    UNIQUE(family_id, user_id, month, year)
);

-- Indexes
CREATE INDEX idx_family_member_earnings_family ON public.family_member_earnings(family_id);
CREATE INDEX idx_family_member_earnings_user ON public.family_member_earnings(user_id);
CREATE INDEX idx_family_member_earnings_month ON public.family_member_earnings(month, year);

-- =============================================================================
-- FAMILY PAYOUT RECORDS
-- Historical record of all payouts
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.family_payout_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES public.troll_families(id) ON DELETE CASCADE,
    
    -- Payout details
    payout_type TEXT NOT NULL, -- weekly, monthly, bonus
    total_amount BIGINT NOT NULL,
    member_count INTEGER NOT NULL,
    amount_per_member BIGINT NOT NULL,
    leader_tax_amount BIGINT DEFAULT 0,
    
    -- Status
    status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
    processed_at TIMESTAMPTZ,
    
    -- Week/Month tracking
    week_number INTEGER,
    year INTEGER,
    month INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_family_payout_records_family ON public.family_payout_records(family_id);
CREATE INDEX idx_family_payout_records_status ON public.family_payout_records(status);
CREATE INDEX idx_family_payout_records_period ON public.family_payout_records(week_number, year);

-- =============================================================================
-- FAMILY LEADER TAX CONFIG
-- Configuration for leader earnings
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.family_leader_tax_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID UNIQUE REFERENCES public.troll_families(id) ON DELETE CASCADE,
    
    -- Tax settings
    leader_user_id UUID REFERENCES public.user_profiles(id),
    tax_percentage DECIMAL(5,2) DEFAULT 5.00,
    monthly_threshold BIGINT DEFAULT 10000, -- Members must earn 10K to trigger tax
    
    -- Tracking
    total_tax_collected BIGINT DEFAULT 0,
    total_tax_paid BIGINT DEFAULT 0,
    last_tax_paid_at TIMESTAMPTZ,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================
ALTER TABLE public.family_earnings_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_member_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_payout_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_leader_tax_config ENABLE ROW LEVEL SECURITY;

-- Family earnings pool: members can view
CREATE POLICY "Family members can view earnings pool" ON public.family_earnings_pool
    FOR SELECT USING (family_id IN (
        SELECT family_id FROM public.family_members WHERE user_id = auth.uid()
    ));

-- Family member earnings: members can view own
CREATE POLICY "Members can view own earnings" ON public.family_member_earnings
    FOR SELECT USING (user_id = auth.uid() OR family_id IN (
        SELECT family_id FROM public.family_members WHERE user_id = auth.uid() AND role IN ('leader', 'co_leader')
    ));

-- Family payout records: members can view
CREATE POLICY "Members can view payout records" ON public.family_payout_records
    FOR SELECT USING (family_id IN (
        SELECT family_id FROM public.family_members WHERE user_id = auth.uid()
    ));

-- Leader tax config: leaders can manage
CREATE POLICY "Leaders can manage tax config" ON public.family_leader_tax_config
    FOR ALL USING (family_id IN (
        SELECT family_id FROM public.family_members WHERE user_id = auth.uid() AND role = 'leader'
    ));

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function: Add earnings to family pool
CREATE OR REPLACE FUNCTION public.add_family_earnings(
    p_family_id UUID,
    p_amount BIGINT,
    p_source TEXT DEFAULT 'task_reward'
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Update family earnings pool
    UPDATE public.family_earnings_pool
    SET 
        total_earned = total_earned + p_amount,
        weekly_earned = weekly_earned + p_amount,
        monthly_earned = monthly_earned + p_amount,
        available_balance = available_balance + p_amount,
        updated_at = NOW()
    WHERE family_id = p_family_id;

    -- If no pool exists, create one
    IF NOT FOUND THEN
        INSERT INTO public.family_earnings_pool (
            family_id, total_earned, weekly_earned, monthly_earned, available_balance
        ) VALUES (
            p_family_id, p_amount, p_amount, p_amount, p_amount
        );
    END IF;

    v_result := jsonb_build_object(
        'success', true,
        'family_id', p_family_id,
        'amount_added', p_amount,
        'source', p_source
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function: Mark weekly goal completion and distribute if all complete
CREATE OR REPLACE FUNCTION public.complete_weekly_goal_for_distribution(
    p_family_id UUID,
    p_goal_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_pool RECORD;
    v_goals_completed INTEGER;
    v_total_goals INTEGER;
    v_result JSONB;
BEGIN
    -- Get current pool and goal status
    SELECT * INTO v_pool FROM public.family_earnings_pool WHERE family_id = p_family_id;
    
    -- Count completed goals this week
    SELECT 
        COUNT(*) FILTER (WHERE status = 'completed')::INTEGER INTO v_goals_completed,
        COUNT(*)::INTEGER INTO v_total_goals
    FROM public.family_goals
    WHERE family_id = p_family_id 
      AND category = 'weekly'
      AND status IN ('active', 'completed');

    -- Update pool with progress
    UPDATE public.family_earnings_pool
    SET 
        current_week_completed = (v_goals_completed + 1) >= v_total_goals,
        current_week_goals = v_goals_completed + 1,
        current_week_total_goals = v_total_goals,
        updated_at = NOW()
    WHERE family_id = p_family_id;

    -- If all goals completed, trigger distribution
    IF (v_goals_completed + 1) >= v_total_goals AND v_total_goals > 0 THEN
        RETURN public.distribute_weekly_earnings(p_family_id);
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'goals_completed', v_goals_completed + 1,
        'total_goals', v_total_goals,
        'all_completed', false
    );
END;
$$ LANGUAGE plpgsql;

-- Function: Distribute weekly earnings to family members
CREATE OR REPLACE FUNCTION public.distribute_weekly_earnings(p_family_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_pool RECORD;
    v_members RECORD;
    v_member_count INTEGER;
    v_amount_per_member BIGINT;
    v_leader_tax_total BIGINT := 0;
    v_leader_id UUID;
    v_leader_tax_percentage DECIMAL(5,2) := 5.00;
    v_monthly_threshold BIGINT := 10000;
    v_payout_id UUID;
    v_current_month INTEGER := EXTRACT(MONTH FROM NOW())::INTEGER;
    v_current_year INTEGER := EXTRACT(YEAR FROM NOW())::INTEGER;
BEGIN
    -- Get family earnings pool
    SELECT * INTO v_pool FROM public.family_earnings_pool WHERE family_id = p_family_id;
    
    IF v_pool IS NULL OR v_pool.available_balance <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No earnings to distribute');
    END IF;

    -- Get active family members
    SELECT COUNT(*) INTO v_member_count
    FROM public.family_members
    WHERE family_id = p_family_id 
      AND left_at IS NULL;

    IF v_member_count = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No active members');
    END IF;

    -- Calculate amount per member (round down)
    v_amount_per_member := v_pool.available_balance / v_member_count;

    -- Get leader info for tax
    SELECT user_id INTO v_leader_id
    FROM public.family_members
    WHERE family_id = p_family_id AND role = 'leader'
    LIMIT 1;

    -- Get leader tax config
    SELECT tax_percentage, monthly_threshold 
    INTO v_leader_tax_percentage, v_monthly_threshold
    FROM public.family_leader_tax_config
    WHERE family_id = p_family_id AND is_active = true
    LIMIT 1;

    -- Create payout record
    INSERT INTO public.family_payout_records (
        family_id, payout_type, total_amount, member_count, amount_per_member,
        week_number, year, status, processed_at
    ) VALUES (
        p_family_id, 'weekly', v_pool.available_balance, v_member_count, v_amount_per_member,
        EXTRACT(WEEK FROM NOW())::INTEGER, EXTRACT(YEAR FROM NOW())::INTEGER, 
        'processing', NOW()
    ) RETURNING id INTO v_payout_id;

    -- Distribute to each member
    FOR v_members IN 
        SELECT fm.user_id, fm.family_id
        FROM public.family_members fm
        WHERE fm.family_id = p_family_id AND fm.left_at IS NULL
    LOOP
        -- Add pending payout to member
        INSERT INTO public.family_member_earnings (
            family_id, user_id, pending_payout, month, year
        ) VALUES (
            v_members.family_id, v_members.user_id, v_amount_per_member,
            v_current_month, v_current_year
        )
        ON CONFLICT (family_id, user_id, month, year) 
        DO UPDATE SET pending_payout = family_member_earnings.pending_payout + v_amount_per_member;

        -- Track total earnings
        UPDATE public.family_member_earnings
        SET total_earned = total_earned + v_amount_per_member,
            monthly_earned = monthly_earned + v_amount_per_member
        WHERE family_id = v_members.family_id 
          AND user_id = v_members.user_id
          AND month = v_current_month 
          AND year = v_current_year;

        -- Check if member exceeded monthly threshold - collect leader tax
        IF v_leader_id IS NOT NULL AND v_members.user_id != v_leader_id THEN
            DECLARE
                v_member_monthly_earn BIGINT;
            BEGIN
                SELECT monthly_earned INTO v_member_monthly_earn
                FROM public.family_member_earnings
                WHERE user_id = v_members.user_id
                  AND month = v_current_month
                  AND year = v_current_year;

                -- If member earned >= threshold this month, collect tax
                IF v_member_monthly_earn >= v_monthly_threshold THEN
                    DECLARE
                        v_tax_amount BIGINT;
                    BEGIN
                        v_tax_amount := (v_member_monthly_earn * v_leader_tax_percentage / 100)::BIGINT;
                        v_leader_tax_total := v_leader_tax_total + v_tax_amount;

                        -- Mark tax as collected
                        UPDATE public.family_member_earnings
                        SET leader_tax_collected = leader_tax_collected + v_tax_amount,
                            leader_tax_paid = false,
                            tax_month = v_current_month,
                            tax_year = v_current_year
                        WHERE user_id = v_members.user_id
                          AND month = v_current_month
                          AND year = v_current_year;
                    END;
                END IF;
            END;
        END IF;
    END LOOP;

    -- Update pool to mark distribution
    UPDATE public.family_earnings_pool
    SET 
        available_balance = 0,
        pending_distribution = v_pool.available_balance,
        last_distribution_at = NOW(),
        current_week_completed = false,
        current_week_goals = 0,
        updated_at = NOW()
    WHERE family_id = p_family_id;

    -- Update payout record
    UPDATE public.family_payout_records
    SET status = 'completed',
        leader_tax_amount = v_leader_tax_total,
        processed_at = NOW()
    WHERE id = v_payout_id;

    -- Add leader tax to leader's earnings if collected
    IF v_leader_id IS NOT NULL AND v_leader_tax_total > 0 THEN
        INSERT INTO public.family_member_earnings (
            family_id, user_id, pending_payout, total_earned, leader_tax_collected,
            leader_tax_paid, tax_month, tax_year, month, year
        ) VALUES (
            p_family_id, v_leader_id, v_leader_tax_total, v_leader_tax_total, v_leader_tax_total,
            true, v_current_month, v_current_year, v_current_month, v_current_year
        )
        ON CONFLICT (family_id, user_id, month, year) 
        DO UPDATE SET 
            pending_payout = family_member_earnings.pending_payout + v_leader_tax_total,
            total_earned = family_member_earnings.total_earned + v_leader_tax_total,
            leader_tax_collected = family_member_earnings.leader_tax_collected + v_leader_tax_total,
            leader_tax_paid = true;

        -- Update leader tax config
        UPDATE public.family_leader_tax_config
        SET total_tax_collected = total_tax_collected + v_leader_tax_total,
            total_tax_paid = total_tax_paid + v_leader_tax_total,
            last_tax_paid_at = NOW(),
            updated_at = NOW()
        WHERE family_id = p_family_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'total_distributed', v_pool.available_balance,
        'member_count', v_member_count,
        'amount_per_member', v_amount_per_member,
        'leader_tax_collected', v_leader_tax_total,
        'payout_id', v_payout_id
    );
END;
$$ LANGUAGE plpgsql;

-- Function: Process leader tax payment
CREATE OR REPLACE FUNCTION public.pay_leader_tax(p_family_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_config RECORD;
    v_unpaid_tax BIGINT := 0;
    v_leader_id UUID;
BEGIN
    -- Get leader tax config
    SELECT * INTO v_config FROM public.family_leader_tax_config WHERE family_id = p_family_id;
    
    IF v_config IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No tax config for family');
    END IF;

    -- Get leader user ID
    SELECT user_id INTO v_leader_id
    FROM public.family_members
    WHERE family_id = p_family_id AND role = 'leader'
    LIMIT 1;

    -- Calculate unpaid tax from members
    SELECT COALESCE(SUM(leader_tax_collected), 0) - COALESCE(SUM(
        CASE WHEN leader_tax_paid THEN leader_tax_collected ELSE 0 END
    ), 0)
    INTO v_unpaid_tax
    FROM public.family_member_earnings
    WHERE family_id = p_family_id
      AND leader_tax_collected > 0
      AND (leader_tax_paid = false OR leader_tax_paid IS NULL);

    IF v_unpaid_tax <= 0 THEN
        RETURN jsonb_build_object('success', true, 'message', 'No unpaid tax');
    END IF;

    -- Add unpaid tax to leader's pending payout
    UPDATE public.family_member_earnings
    SET pending_payout = pending_payout + v_unpaid_tax,
        leader_tax_paid = true
    WHERE family_id = p_family_id 
      AND user_id = v_leader_id;

    -- Update config
    UPDATE public.family_leader_tax_config
    SET total_tax_paid = total_tax_paid + v_unpaid_tax,
        last_tax_paid_at = NOW(),
        updated_at = NOW()
    WHERE family_id = p_family_id;

    RETURN jsonb_build_object(
        'success', true,
        'leader_id', v_leader_id,
        'tax_paid', v_unpaid_tax
    );
END;
$$ LANGUAGE plpgsql;

-- Function: Get member's pending payout
CREATE OR REPLACE FUNCTION public.get_member_pending_payout(
    p_family_id UUID,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_earnings RECORD;
    v_current_month INTEGER := EXTRACT(MONTH FROM NOW())::INTEGER;
    v_current_year INTEGER := EXTRACT(YEAR FROM NOW())::INTEGER;
BEGIN
    SELECT * INTO v_earnings
    FROM public.family_member_earnings
    WHERE family_id = p_family_id 
      AND user_id = p_user_id
      AND month = v_current_month 
      AND year = v_current_year;

    IF v_earnings IS NULL THEN
        RETURN jsonb_build_object(
            'pending_payout', 0,
            'monthly_earned', 0,
            'leader_tax', 0
        );
    END IF;

    RETURN jsonb_build_object(
        'pending_payout', v_earnings.pending_payout,
        'monthly_earned', v_earnings.monthly_earned,
        'leader_tax', v_earnings.leader_tax_collected,
        'total_earned', v_earnings.total_earned
    );
END;
$$ LANGUAGE plpgsql;

-- Function: Reset weekly earnings (called by scheduler)
CREATE OR REPLACE FUNCTION public.reset_weekly_family_earnings()
RETURNS JSONB AS $$
BEGIN
    -- Reset weekly_earned for all families
    UPDATE public.family_earnings_pool
    SET 
        weekly_earned = 0,
        current_week_goals = 0,
        current_week_completed = false,
        updated_at = NOW()
    WHERE last_reset_at < NOW() - INTERVAL '7 days'
       OR last_reset_at IS NULL;

    -- Reset last_reset_at for those updated
    UPDATE public.family_earnings_pool
    SET last_reset_at = NOW()
    WHERE last_reset_at < NOW() - INTERVAL '7 days'
       OR last_reset_at IS NULL;

    RETURN jsonb_build_object('success', true, 'message', 'Weekly earnings reset');
END;
$$ LANGUAGE plpgsql;

-- Function: Monthly reset (called by scheduler)
CREATE OR REPLACE FUNCTION public.reset_monthly_family_earnings()
RETURNS JSONB AS $$
BEGIN
    -- Reset monthly_earned for all families
    UPDATE public.family_earnings_pool
    SET 
        monthly_earned = 0,
        updated_at = NOW()
    WHERE EXTRACT(MONTH FROM last_reset_at) < EXTRACT(MONTH FROM NOW())
       OR last_reset_at IS NULL;

    -- Reset member leader tax tracking
    UPDATE public.family_member_earnings
    SET 
        leader_tax_paid = false,
        tax_month = EXTRACT(MONTH FROM NOW())::INTEGER,
        tax_year = EXTRACT(YEAR FROM NOW())::INTEGER
    WHERE tax_month < EXTRACT(MONTH FROM NOW())::INTEGER
       OR tax_month IS NULL;

    RETURN jsonb_build_object('success', true, 'message', 'Monthly earnings and tax reset');
END;
$$ LANGUAGE plpgsql;

-- Function: Set up leader tax for family
CREATE OR REPLACE FUNCTION public.setup_family_leader_tax(
    p_family_id UUID,
    p_leader_user_id UUID,
    p_tax_percentage DECIMAL(5,2) DEFAULT 5.00,
    p_monthly_threshold BIGINT DEFAULT 10000
)
RETURNS JSONB AS $$
BEGIN
    -- Insert or update leader tax config
    INSERT INTO public.family_leader_tax_config (
        family_id, leader_user_id, tax_percentage, monthly_threshold, is_active
    ) VALUES (
        p_family_id, p_leader_user_id, p_tax_percentage, p_monthly_threshold, true
    )
    ON CONFLICT (family_id) DO UPDATE SET
        leader_user_id = p_leader_user_id,
        tax_percentage = p_tax_percentage,
        monthly_threshold = p_monthly_threshold,
        is_active = true,
        updated_at = NOW();

    RETURN jsonb_build_object(
        'success', true,
        'family_id', p_family_id,
        'leader_id', p_leader_user_id,
        'tax_percentage', p_tax_percentage,
        'monthly_threshold', p_monthly_threshold
    );
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================
GRANT SELECT ON public.family_earnings_pool TO authenticated;
GRANT SELECT ON public.family_member_earnings TO authenticated;
GRANT SELECT ON public.family_payout_records TO authenticated;
GRANT ALL ON public.family_leader_tax_config TO authenticated;

GRANT EXECUTE ON FUNCTION public.add_family_earnings(UUID, BIGINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_weekly_goal_for_distribution(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.distribute_weekly_earnings(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_leader_tax(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_pending_payout(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_weekly_family_earnings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_monthly_family_earnings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.setup_family_leader_tax(UUID, UUID, DECIMAL, BIGINT) TO authenticated;

SELECT 'Family Earnings & Payout System created successfully!' AS result;
