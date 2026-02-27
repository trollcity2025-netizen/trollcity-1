-- ============================================================================
-- TROLLZ GIVEAWAY SYSTEM - CONSOLIDATED MIGRATION
-- Run this entire script in your Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- SECTION 1: TROLL BATTLES SETUP (fixes current error)
-- ============================================================================

-- 1. Battle Queue: Users waiting for a match
CREATE TABLE IF NOT EXISTS public.battle_queue (
    user_id UUID REFERENCES public.user_profiles(id) PRIMARY KEY,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    min_level INTEGER DEFAULT 0
);

ALTER TABLE public.battle_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can insert" ON public.battle_queue;
CREATE POLICY "Anyone can insert" ON public.battle_queue FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Anyone can delete own" ON public.battle_queue;
CREATE POLICY "Anyone can delete own" ON public.battle_queue FOR DELETE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Public read queue" ON public.battle_queue;
CREATE POLICY "Public read queue" ON public.battle_queue FOR SELECT USING (true);

-- 2. Troll Battles: The match record
CREATE TABLE IF NOT EXISTS public.troll_battles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    player1_id UUID REFERENCES public.user_profiles(id) NOT NULL,
    player2_id UUID REFERENCES public.user_profiles(id) NOT NULL,
    player1_score INTEGER DEFAULT 0,
    player2_score INTEGER DEFAULT 0,
    status TEXT CHECK (status IN ('pending', 'active', 'completed', 'cancelled')) DEFAULT 'pending',
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    winner_id UUID REFERENCES public.user_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.troll_battles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read battles" ON public.troll_battles;
CREATE POLICY "Public read battles" ON public.troll_battles FOR SELECT USING (true);
DROP POLICY IF EXISTS "System update battles" ON public.troll_battles;
CREATE POLICY "System update battles" ON public.troll_battles FOR ALL USING (true);

-- 3. Battle Skips: Track daily skips
CREATE TABLE IF NOT EXISTS public.battle_skips (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id) NOT NULL,
    skip_date DATE DEFAULT CURRENT_DATE,
    skips_used INTEGER DEFAULT 0,
    last_skip_time TIMESTAMP WITH TIME ZONE,
    UNIQUE(user_id, skip_date)
);

ALTER TABLE public.battle_skips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read own skips" ON public.battle_skips;
CREATE POLICY "Read own skips" ON public.battle_skips FOR SELECT USING (auth.uid() = user_id);

-- 4. Weekly Stats
CREATE TABLE IF NOT EXISTS public.troll_battle_weekly_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id) NOT NULL,
    week_start_date DATE NOT NULL,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    total_score INTEGER DEFAULT 0,
    UNIQUE(user_id, week_start_date)
);

ALTER TABLE public.troll_battle_weekly_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read stats" ON public.troll_battle_weekly_stats;
CREATE POLICY "Public read stats" ON public.troll_battle_weekly_stats FOR SELECT USING (true);

-- RPC: Find Opponent
DROP FUNCTION IF EXISTS public.find_opponent(uuid, text, text, integer);
DROP FUNCTION IF EXISTS public.find_opponent(uuid);

CREATE OR REPLACE FUNCTION public.find_opponent(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_opponent_id UUID;
    v_battle_id UUID;
    v_existing_battle JSONB;
BEGIN
    -- Check if already in a pending battle
    SELECT to_jsonb(t) INTO v_existing_battle
    FROM public.troll_battles t
    WHERE (player1_id = p_user_id OR player2_id = p_user_id)
      AND status = 'pending'
    LIMIT 1;

    IF v_existing_battle IS NOT NULL THEN
        RETURN jsonb_build_object('status', 'matched', 'battle', v_existing_battle);
    END IF;

    -- Try to find someone else in the queue
    SELECT user_id INTO v_opponent_id
    FROM public.battle_queue
    WHERE user_id != p_user_id
    ORDER BY joined_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_opponent_id IS NOT NULL THEN
        -- Match found! Create battle
        INSERT INTO public.troll_battles (player1_id, player2_id, status)
        VALUES (p_user_id, v_opponent_id, 'pending')
        RETURNING id INTO v_battle_id;

        -- Remove both from queue
        DELETE FROM public.battle_queue WHERE user_id IN (p_user_id, v_opponent_id);

        RETURN jsonb_build_object('status', 'matched', 'battle_id', v_battle_id, 'opponent_id', v_opponent_id);
    ELSE
        -- No match, add to queue
        INSERT INTO public.battle_queue (user_id)
        VALUES (p_user_id)
        ON CONFLICT (user_id) DO NOTHING;
        
        RETURN jsonb_build_object('status', 'queued');
    END IF;
END;
$$;

-- RPC: Skip Opponent
CREATE OR REPLACE FUNCTION public.skip_opponent(p_user_id UUID, p_battle_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_battle RECORD;
    v_skips RECORD;
    v_cost INTEGER := 5;
    v_free_limit INTEGER := 5;
    v_opponent_id UUID;
BEGIN
    -- Get battle
    SELECT * INTO v_battle FROM public.troll_battles WHERE id = p_battle_id;
    IF v_battle IS NULL OR v_battle.status != 'pending' THEN
        RETURN jsonb_build_object('error', 'Invalid battle');
    END IF;

    -- Determine opponent
    IF v_battle.player1_id = p_user_id THEN
        v_opponent_id := v_battle.player2_id;
    ELSIF v_battle.player2_id = p_user_id THEN
        v_opponent_id := v_battle.player1_id;
    ELSE
        RETURN jsonb_build_object('error', 'Not a participant');
    END IF;

    -- Check skips
    SELECT * INTO v_skips FROM public.battle_skips 
    WHERE user_id = p_user_id AND skip_date = CURRENT_DATE;

    IF v_skips IS NULL THEN
        INSERT INTO public.battle_skips (user_id, skips_used) VALUES (p_user_id, 0)
        RETURNING * INTO v_skips;
    END IF;

    IF v_skips.skips_used >= v_free_limit THEN
        NULL; -- Charge coins logic would go here
    END IF;

    UPDATE public.battle_skips 
    SET skips_used = skips_used + 1, last_skip_time = NOW()
    WHERE id = v_skips.id;

    -- Cancel battle
    UPDATE public.troll_battles SET status = 'cancelled' WHERE id = p_battle_id;

    -- Re-queue opponent
    INSERT INTO public.battle_queue (user_id) VALUES (v_opponent_id) ON CONFLICT DO NOTHING;

    -- Re-queue current user to find new opponent
    PERFORM public.find_opponent(p_user_id);

    RETURN jsonb_build_object('success', true, 'skips_used', v_skips.skips_used + 1);
END;
$$;

-- RPC: Start Battle
CREATE OR REPLACE FUNCTION public.start_battle(p_battle_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.troll_battles
    SET status = 'active', start_time = NOW(), end_time = NOW() + INTERVAL '3 minutes'
    WHERE id = p_battle_id AND status = 'pending';
END;
$$;


-- ============================================================================
-- SECTION 2: VIP SYSTEM COLUMNS
-- ============================================================================

-- Add VIP columns to user_profiles (if not exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'vip_expires_at') THEN
        ALTER TABLE public.user_profiles ADD COLUMN vip_expires_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'vip_tier') THEN
        ALTER TABLE public.user_profiles ADD COLUMN vip_tier TEXT DEFAULT 'standard';
    END IF;
END $$;


-- ============================================================================
-- SECTION 3: GIVEAWAY SYSTEM TABLES
-- ============================================================================

-- Giveaways table
CREATE TABLE IF NOT EXISTS public.giveaways (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    prize_type TEXT NOT NULL CHECK (prize_type IN ('troll_coins', 'vip_badge', 'gift_pack')),
    prize_amount INTEGER, -- coins amount or VIP days
    prize_discount INTEGER, -- for gift packs (5, 10, etc)
    entry_cost INTEGER NOT NULL DEFAULT 100, -- Trollz needed per entry
    max_entries INTEGER, -- maximum entries per user (null = unlimited)
    total_winners INTEGER NOT NULL DEFAULT 1,
    ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES public.user_profiles(id)
);

ALTER TABLE public.giveaways ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read giveaways" ON public.giveaways FOR SELECT USING (true);
CREATE POLICY "Admin manage giveaways" ON public.giveaways FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Giveaway Entries table
CREATE TABLE IF NOT EXISTS public.giveaway_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    giveaway_id UUID REFERENCES public.giveaways(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    entries_count INTEGER NOT NULL DEFAULT 1,
    is_free_entry BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(giveaway_id, user_id, is_free_entry)
);

ALTER TABLE public.giveaway_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read entries" ON public.giveaway_entries FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert own entries" ON public.giveaway_entries;
CREATE POLICY "Users can insert own entries" ON public.giveaway_entries
    FOR INSERT
    WITH CHECK ( auth.uid() = user_id );

-- User Rewards table (won prizes)
CREATE TABLE IF NOT EXISTS public.user_rewards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    giveaway_id UUID REFERENCES public.giveaways(id) ON DELETE SET NULL,
    prize_type TEXT NOT NULL,
    prize_amount INTEGER,
    prize_discount INTEGER,
    is_claimed BOOLEAN DEFAULT false,
    claimed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.user_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own rewards" ON public.user_rewards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users claim own rewards" ON public.user_rewards FOR UPDATE USING (auth.uid() = user_id);

-- Discount Codes table (for gift packs)
CREATE TABLE IF NOT EXISTS public.discount_codes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    discount_percent INTEGER NOT NULL CHECK (discount_percent BETWEEN 1 AND 100),
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active codes" ON public.discount_codes FOR SELECT USING (is_active = true);


-- ============================================================================
-- SECTION 4: GIVEAWAY RPC FUNCTIONS
-- ============================================================================

-- Enter Giveaway RPC
DROP FUNCTION IF EXISTS public.enter_giveaway(UUID, UUID, BOOLEAN);

CREATE OR REPLACE FUNCTION public.enter_giveaway(
    p_user_id UUID,
    p_giveaway_id UUID,
    p_use_free_entry BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_giveaway RECORD;
    v_entry RECORD;
    v_balance INTEGER;
    v_cost INTEGER;
    v_existing_free_entry BOOLEAN;
    v_total_entries INTEGER;
BEGIN
    -- Get giveaway details
    SELECT * INTO v_giveaway 
    FROM public.giveaways 
    WHERE id = p_giveaway_id AND is_active = true AND ends_at > NOW();
    
    IF v_giveaway IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Giveaway not found or has ended');
    END IF;
    
    -- Check for existing free entry
    IF p_use_free_entry THEN
        SELECT EXISTS(
            SELECT 1 FROM public.giveaway_entries 
            WHERE giveaway_id = p_giveaway_id AND user_id = p_user_id AND is_free_entry = true
        ) INTO v_existing_free_entry;
        
        IF v_existing_free_entry THEN
            RETURN jsonb_build_object('success', false, 'error', 'You have already used your free entry');
        END IF;
    END IF;
    
    -- Calculate cost
    IF p_use_free_entry THEN
        v_cost := 0;
    ELSE
        v_cost := v_giveaway.entry_cost;
    END IF;
    
    -- Check user balance (server-side validation)
    IF v_cost > 0 THEN
        SELECT coins INTO v_balance FROM public.user_profiles WHERE id = p_user_id;
        
        IF v_balance IS NULL OR v_balance < v_cost THEN
            RETURN jsonb_build_object('success', false, 'error', 'Insufficient Trollz balance');
        END IF;
        
        -- Deduct Trollz
        UPDATE public.user_profiles 
        SET coins = coins - v_cost 
        WHERE id = p_user_id;
    END IF;
    
    -- Check for existing entry (merge entries)
    SELECT * INTO v_entry 
    FROM public.giveaway_entries 
    WHERE giveaway_id = p_giveaway_id AND user_id = p_user_id AND is_free_entry = false;
    
    IF v_entry IS NOT NULL THEN
        -- Add to existing entry
        UPDATE public.giveaway_entries 
        SET entries_count = entries_count + 1 
        WHERE id = v_entry.id;
    ELSE
        -- Create new entry
        INSERT INTO public.giveaway_entries (giveaway_id, user_id, entries_count, is_free_entry)
        VALUES (p_giveaway_id, p_user_id, 1, p_use_free_entry);
    END IF;
    
    -- Get total entries for response
    SELECT SUM(entries_count) INTO v_total_entries
    FROM public.giveaway_entries
    WHERE giveaway_id = p_giveaway_id AND user_id = p_user_id;
    
    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Entry added successfully',
        'entries', v_total_entries,
        'cost', v_cost
    );
END;
$$;

-- Draw Winner RPC
DROP FUNCTION IF EXISTS public.draw_giveaway_winner(UUID);

CREATE OR REPLACE FUNCTION public.draw_giveaway_winner(p_giveaway_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_giveaway RECORD;
    v_winner_id UUID;
    v_total_entries INTEGER;
    v_random_val NUMERIC;
    v_entry RECORD;
    v_cumulative INTEGER := 0;
    v_target NUMERIC;
BEGIN
    -- Get giveaway
    SELECT * INTO v_giveaway FROM public.giveaways WHERE id = p_giveaway_id;
    
    IF v_giveaway IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Giveaway not found');
    END IF;
    
    IF v_giveaway.is_active = false THEN
        RETURN jsonb_build_object('success', false, 'error', 'Giveaway is already closed');
    END IF;
    
    -- Get total entries
    SELECT COALESCE(SUM(entries_count), 0) INTO v_total_entries
    FROM public.giveaway_entries
    WHERE giveaway_id = p_giveaway_id;
    
    IF v_total_entries = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No entries in this giveaway');
    END IF;
    
    -- Weighted random selection
    v_target := random() * v_total_entries;
    
    FOR v_entry IN 
        SELECT user_id, entries_count 
        FROM public.giveaway_entries 
        WHERE giveaway_id = p_giveaway_id
        ORDER BY created_at
    LOOP
        v_cumulative := v_cumulative + v_entry.entries_count;
        IF v_cumulative >= v_target THEN
            v_winner_id := v_user_id;
            EXIT;
        END IF;
    END LOOP;
    
    -- If no winner selected (edge case), pick first
    IF v_winner_id IS NULL THEN
        SELECT user_id INTO v_winner_id 
        FROM public.giveaway_entries 
        WHERE giveaway_id = p_giveaway_id 
        ORDER BY random() 
        LIMIT 1;
    END IF;
    
    -- Award prize
    INSERT INTO public.user_rewards (user_id, giveaway_id, prize_type, prize_amount, prize_discount)
    VALUES (
        v_winner_id, 
        p_giveaway_id, 
        v_giveaway.prize_type, 
        v_giveaway.prize_amount,
        v_giveaway.prize_discount
    );
    
    -- Credit coins if prize is troll_coins
    IF v_giveaway.prize_type = 'troll_coins' THEN
        UPDATE public.user_profiles 
        SET coins = coins + v_giveaway.prize_amount 
        WHERE id = v_winner_id;
    END IF;
    
    -- Credit VIP if prize is vip_badge
    IF v_giveaway.prize_type = 'vip_badge' THEN
        UPDATE public.user_profiles 
        SET vip_expires_at = COALESCE(vip_expires_at, NOW()) + (v_giveaway.prize_amount || ' days')::INTERVAL,
            vip_tier = 'premium'
        WHERE id = v_winner_id;
    END IF;
    
    -- Close giveaway
    UPDATE public.giveaways SET is_active = false WHERE id = p_giveaway_id;
    
    RETURN jsonb_build_object(
        'success', true, 
        'winner_id', v_winner_id,
        'prize_type', v_giveaway.prize_type,
        'prize_amount', v_giveaway.prize_amount
    );
END;
$$;

-- Get User Entries RPC
DROP FUNCTION IF EXISTS public.get_my_giveaway_entries(UUID);

CREATE OR REPLACE FUNCTION public.get_my_giveaway_entries(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT jsonb_agg(jsonb_build_object(
            'giveaway_id', giveaway_id,
            'entries_count', entries_count,
            'is_free_entry', is_free_entry,
            'created_at', created_at
        ))
        FROM public.giveaway_entries
        WHERE user_id = p_user_id
    );
END;
$$;

-- Get My Rewards RPC
DROP FUNCTION IF EXISTS public.get_my_rewards(UUID);

CREATE OR REPLACE FUNCTION public.get_my_rewards(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT jsonb_agg(jsonb_build_object(
            'id', id,
            'giveaway_id', giveaway_id,
            'prize_type', prize_type,
            'prize_amount', prize_amount,
            'prize_discount', prize_discount,
            'is_claimed', is_claimed,
            'claimed_at', claimed_at,
            'created_at', created_at
        ))
        FROM public.user_rewards
        WHERE user_id = p_user_id
    );
END;
$$;

-- Claim Reward RPC
DROP FUNCTION IF EXISTS public.claim_reward(UUID, UUID);

CREATE OR REPLACE FUNCTION public.claim_reward(p_user_id UUID, p_reward_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reward RECORD;
    v_code TEXT;
BEGIN
    -- Get reward
    SELECT * INTO v_reward 
    FROM public.user_rewards 
    WHERE id = p_reward_id AND user_id = p_user_id;
    
    IF v_reward IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Reward not found');
    END IF;
    
    IF v_reward.is_claimed THEN
        RETURN jsonb_build_object('success', false, 'error', 'Reward already claimed');
    END IF;
    
    -- Generate discount code for gift packs
    IF v_reward.prize_type = 'gift_pack' THEN
        -- Generate unique code
        v_code := 'GIFT' || upper(substring(md5(gen_random_uuid()::text) from 1 for 6));
        
        INSERT INTO public.discount_codes (code, discount_percent, expires_at)
        VALUES (v_code, v_reward.prize_discount, NOW() + INTERVAL '30 days');
    END IF;
    
    -- Mark as claimed
    UPDATE public.user_rewards 
    SET is_claimed = true, claimed_at = NOW() 
    WHERE id = p_reward_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Reward claimed successfully',
        'discount_code', v_code
    );
END;
$$;


-- ============================================================================
-- SECTION 5: SEED TEST GIVEAWAYS
-- ============================================================================

INSERT INTO public.giveaways (title, description, prize_type, prize_amount, entry_cost_trollz, end_time, allow_free_entry)
    VALUES 
    ('1,000 Troll Coins Giveaway', 'Win 1,000 free Troll Coins!', 'troll_coins', 1000, 100, NOW() + INTERVAL '7 days', true),
    ('2,000 Troll Coins Giveaway', 'Win 2,000 free Troll Coins!', 'troll_coins', 2000, 200, NOW() + INTERVAL '7 days', true),
    ('7-Day VIP Badge', 'Win a 7-day VIP badge!', 'vip_badge', NULL, 300, NOW() + INTERVAL '7 days', true),
    ('30-Day VIP Gold', 'Win a 30-day Gold VIP badge!', 'vip_badge', NULL, 500, NOW() + INTERVAL '7 days', true),
    ('5% Gift Pack', 'Get a 5% discount on Coin Store!', 'gift_pack', NULL, 150, NOW() + INTERVAL '7 days', true),
    ('10% Gift Pack', 'Get a 10% discount on Coin Store!', 'gift_pack', NULL, 250, NOW() + INTERVAL '7 days', true)
    ON CONFLICT DO NOTHING;

-- ============================================================================
-- DONE!
-- ============================================================================
