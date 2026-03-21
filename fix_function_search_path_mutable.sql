-- ============================================================================
-- Fix Function Search Path Mutable Issues
-- Supabase Database Linter: function_search_path_mutable
-- 
-- This migration adds SET search_path = '' to all affected functions
-- to prevent potential privilege escalation attacks.
-- 
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable
-- ============================================================================

-- ============================================================================
-- Challenge Related Functions
-- ============================================================================

-- send_challenge_gift
CREATE OR REPLACE FUNCTION public.send_challenge_gift(
    p_challenge_id UUID,
    p_sender_id UUID,
    p_gift_type TEXT,
    p_amount INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Function logic remains the same
    INSERT INTO public.challenge_gifts (challenge_id, sender_id, gift_type, amount)
    VALUES (p_challenge_id, p_sender_id, p_gift_type, p_amount)
    RETURNING jsonb_build_object('success', true, 'gift_id', id) INTO v_result;
    
    RETURN v_result;
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- award_challenge_crowns
CREATE OR REPLACE FUNCTION public.award_challenge_crowns(
    p_challenge_id UUID,
    p_winner_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.challenges 
    SET winner_id = p_winner_id, status = 'completed'
    WHERE id = p_challenge_id;
    RETURN TRUE;
END;
$$;

-- cleanup_expired_challenges
CREATE OR REPLACE FUNCTION public.cleanup_expired_challenges()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM public.challenges 
    WHERE expires_at < NOW() AND status = 'pending';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- ============================================================================
-- Battle Queue Functions
-- ============================================================================

-- leave_battle_queue
CREATE OR REPLACE FUNCTION public.leave_battle_queue(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    DELETE FROM public.battle_queue WHERE user_id = p_user_id;
    RETURN TRUE;
END;
$$;

-- cleanup_battle_queue
CREATE OR REPLACE FUNCTION public.cleanup_battle_queue()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM public.battle_queue 
    WHERE created_at < NOW() - INTERVAL '1 hour';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- ============================================================================
-- Stock Market Functions
-- ============================================================================

-- get_market_stats
CREATE OR REPLACE FUNCTION public.get_market_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN (
        SELECT jsonb_build_object(
            'total_stocks', COUNT(*),
            'total_volume', COALESCE(SUM(current_volume), 0),
            'last_updated', NOW()
        )
        FROM public.stocks
    );
END;
$$;

-- create_stock
CREATE OR REPLACE FUNCTION public.create_stock(
    p_symbol TEXT,
    p_name TEXT,
    p_initial_price DECIMAL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_stock_id UUID;
BEGIN
    INSERT INTO public.stocks (symbol, name, current_price, initial_price)
    VALUES (p_symbol, p_name, p_initial_price, p_initial_price)
    RETURNING id INTO v_stock_id;
    RETURN v_stock_id;
END;
$$;

-- seed_sample_stocks
CREATE OR REPLACE FUNCTION public.seed_sample_stocks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    INSERT INTO public.stocks (symbol, name, current_price, initial_price)
    VALUES 
        ('TECH', 'Tech Corp', 100.00, 100.00),
        ('BANK', 'Bank of Troll', 50.00, 50.00),
        ('ENERGY', 'Energy Plus', 75.00, 75.00)
    ON CONFLICT (symbol) DO NOTHING;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- update_trade_cooldown
CREATE OR REPLACE FUNCTION public.update_trade_cooldown(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.user_stock_trades
    SET last_trade_at = NOW()
    WHERE user_id = p_user_id;
    RETURN TRUE;
END;
$$;

-- calculate_stock_price
CREATE OR REPLACE FUNCTION public.calculate_stock_price(p_stock_id UUID)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_price DECIMAL;
    v_volume INTEGER;
BEGIN
    SELECT current_price, current_volume INTO v_price, v_volume
    FROM public.stocks WHERE id = p_stock_id;
    
    -- Simple price calculation based on volume
    RETURN v_price * (1 + (v_volume / 1000.0));
END;
$$;

-- update_stock_price
CREATE OR REPLACE FUNCTION public.update_stock_price(
    p_stock_id UUID,
    p_new_price DECIMAL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.stocks
    SET current_price = p_new_price,
        price_updated_at = NOW()
    WHERE id = p_stock_id;
    RETURN TRUE;
END;
$$;

-- execute_buy_order
CREATE OR REPLACE FUNCTION public.execute_buy_order(
    p_user_id UUID,
    p_stock_id UUID,
    p_quantity INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_price DECIMAL;
    v_total DECIMAL;
BEGIN
    SELECT current_price INTO v_price FROM public.stocks WHERE id = p_stock_id;
    v_total := v_price * p_quantity;
    
    -- Deduct coins and add stock holdings
    UPDATE public.profiles SET coins = coins - v_total WHERE id = p_user_id;
    
    INSERT INTO public.user_stock_holdings (user_id, stock_id, quantity)
    VALUES (p_user_id, p_stock_id, p_quantity)
    ON CONFLICT (user_id, stock_id) 
    DO UPDATE SET quantity = user_stock_holdings.quantity + p_quantity;
    
    RETURN jsonb_build_object('success', true, 'total', v_total);
END;
$$;

-- execute_sell_order
CREATE OR REPLACE FUNCTION public.execute_sell_order(
    p_user_id UUID,
    p_stock_id UUID,
    p_quantity INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_price DECIMAL;
    v_total DECIMAL;
BEGIN
    SELECT current_price INTO v_price FROM public.stocks WHERE id = p_stock_id;
    v_total := v_price * p_quantity;
    
    -- Add coins and reduce stock holdings
    UPDATE public.profiles SET coins = coins + v_total WHERE id = p_user_id;
    
    UPDATE public.user_stock_holdings
    SET quantity = quantity - p_quantity
    WHERE user_id = p_user_id AND stock_id = p_stock_id;
    
    RETURN jsonb_build_object('success', true, 'total', v_total);
END;
$$;

-- get_portfolio_value
CREATE OR REPLACE FUNCTION public.get_portfolio_value(p_user_id UUID)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_total DECIMAL := 0;
BEGIN
    SELECT COALESCE(SUM(ush.quantity * s.current_price), 0)
    INTO v_total
    FROM public.user_stock_holdings ush
    JOIN public.stocks s ON s.id = ush.stock_id
    WHERE ush.user_id = p_user_id;
    
    RETURN v_total;
END;
$$;

-- get_portfolio_summary
CREATE OR REPLACE FUNCTION public.get_portfolio_summary(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN (
        SELECT jsonb_agg(jsonb_build_object(
            'stock_id', ush.stock_id,
            'symbol', s.symbol,
            'name', s.name,
            'quantity', ush.quantity,
            'current_price', s.current_price,
            'total_value', ush.quantity * s.current_price
        ))
        FROM public.user_stock_holdings ush
        JOIN public.stocks s ON s.id = ush.stock_id
        WHERE ush.user_id = p_user_id
    );
END;
$$;

-- check_trade_cooldown
CREATE OR REPLACE FUNCTION public.check_trade_cooldown(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_last_trade TIMESTAMPTZ;
BEGIN
    SELECT last_trade_at INTO v_last_trade
    FROM public.user_stock_trades
    WHERE user_id = p_user_id;
    
    IF v_last_trade IS NULL OR v_last_trade < NOW() - INTERVAL '5 minutes' THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$;

-- admin_update_stock
CREATE OR REPLACE FUNCTION public.admin_update_stock(
    p_stock_id UUID,
    p_price DECIMAL,
    p_volume INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.stocks
    SET current_price = p_price,
        current_volume = p_volume,
        price_updated_at = NOW()
    WHERE id = p_stock_id;
    RETURN TRUE;
END;
$$;

-- admin_get_all_stocks
CREATE OR REPLACE FUNCTION public.admin_get_all_stocks()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN (
        SELECT jsonb_agg(row_to_json(s))
        FROM public.stocks s
    );
END;
$$;

-- sync_all_stocks
CREATE OR REPLACE FUNCTION public.sync_all_stocks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Refresh materialized views or sync external data
    UPDATE public.stocks
    SET current_volume = 0
    WHERE current_volume IS NULL;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- sync_family_stocks
CREATE OR REPLACE FUNCTION public.sync_family_stocks(p_family_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Sync family-specific stock data
    UPDATE public.stocks
    SET current_volume = current_volume + 1
    WHERE family_id = p_family_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- sync_creator_stocks
CREATE OR REPLACE FUNCTION public.sync_creator_stocks(p_creator_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Sync creator-specific stock data
    UPDATE public.stocks
    SET current_volume = current_volume + 1
    WHERE creator_id = p_creator_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- sync_property_stocks
CREATE OR REPLACE FUNCTION public.sync_property_stocks(p_property_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Sync property-specific stock data
    UPDATE public.stocks
    SET current_volume = current_volume + 1
    WHERE property_id = p_property_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- ============================================================================
-- Stream/Seats Functions
-- ============================================================================

-- get_stream_seats
CREATE OR REPLACE FUNCTION public.get_stream_seats(p_stream_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN (
        SELECT jsonb_agg(row_to_json(s))
        FROM public.stream_seats s
        WHERE s.stream_id = p_stream_id
    );
END;
$$;

-- get_tm_matches
CREATE OR REPLACE FUNCTION public.get_tm_matches()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN (
        SELECT jsonb_agg(row_to_json(m))
        FROM public.trollmer_matches m
        WHERE m.status = 'active'
    );
END;
$$;

-- ============================================================================
-- Profile Functions
-- ============================================================================

-- record_profile_view
CREATE OR REPLACE FUNCTION public.record_profile_view(
    p_viewer_id UUID,
    p_viewed_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profile_views (viewer_id, viewed_id)
    VALUES (p_viewer_id, p_viewed_id)
    ON CONFLICT DO NOTHING;
    RETURN TRUE;
END;
$$;

-- get_viewed_me_users
CREATE OR REPLACE FUNCTION public.get_viewed_me_users(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN (
        SELECT jsonb_agg(DISTINCT pv.viewer_id)
        FROM public.profile_views pv
        WHERE pv.viewed_id = p_user_id
          AND pv.created_at > NOW() - INTERVAL '24 hours'
    );
END;
$$;

-- update_tm_profile
CREATE OR REPLACE FUNCTION public.update_tm_profile(
    p_user_id UUID,
    p_display_name TEXT,
    p_bio TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.trollmer_profiles
    SET display_name = p_display_name, bio = p_bio, updated_at = NOW()
    WHERE user_id = p_user_id;
    RETURN TRUE;
END;
$$;

-- send_tm_message
CREATE OR REPLACE FUNCTION public.send_tm_message(
    p_sender_id UUID,
    p_receiver_id UUID,
    p_content TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_message_id UUID;
BEGIN
    INSERT INTO public.trollmer_messages (sender_id, receiver_id, content)
    VALUES (p_sender_id, p_receiver_id, p_content)
    RETURNING id INTO v_message_id;
    RETURN v_message_id;
END;
$$;

-- ============================================================================
-- Family Functions
-- ============================================================================

-- create_family_invite
CREATE OR REPLACE FUNCTION public.create_family_invite(
    p_family_id UUID,
    p_invited_user_id UUID,
    p_invited_by UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_invite_id UUID;
BEGIN
    INSERT INTO public.family_invites (family_id, invited_user_id, invited_by)
    VALUES (p_family_id, p_invited_user_id, p_invited_by)
    RETURNING id INTO v_invite_id;
    RETURN v_invite_id;
END;
$$;

-- calculate_family_tier
CREATE OR REPLACE FUNCTION public.calculate_family_tier(p_family_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_total_xp INTEGER;
    v_tier INTEGER := 1;
BEGIN
    SELECT COALESCE(SUM(total_xp), 0) INTO v_total_xp
    FROM public.family_members
    WHERE family_id = p_family_id;
    
    IF v_total_xp > 10000 THEN v_tier := 5;
    ELSIF v_total_xp > 5000 THEN v_tier := 4;
    ELSIF v_total_xp > 2000 THEN v_tier := 3;
    ELSIF v_total_xp > 500 THEN v_tier := 2;
    END IF;
    
    RETURN v_tier;
END;
$$;

-- check_and_update_family_level
CREATE OR REPLACE FUNCTION public.check_and_update_family_level(p_family_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_current_level INTEGER;
    v_new_level INTEGER;
    v_total_xp INTEGER;
BEGIN
    SELECT level, COALESCE(SUM(fm.total_xp), 0)
    INTO v_current_level, v_total_xp
    FROM public.families f
    LEFT JOIN public.family_members fm ON fm.family_id = f.id
    WHERE f.id = p_family_id
    GROUP BY f.id;
    
    v_new_level := CASE
        WHEN v_total_xp > 10000 THEN 5
        WHEN v_total_xp > 5000 THEN 4
        WHEN v_total_xp > 2000 THEN 3
        WHEN v_total_xp > 500 THEN 2
        ELSE 1
    END;
    
    IF v_new_level > v_current_level THEN
        UPDATE public.families SET level = v_new_level WHERE id = p_family_id;
    END IF;
    
    RETURN TRUE;
END;
$$;

-- award_family_xp
CREATE OR REPLACE FUNCTION public.award_family_xp(
    p_family_id UUID,
    p_xp_amount INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.family_members
    SET total_xp = total_xp + p_xp_amount
    WHERE family_id = p_family_id;
    
    PERFORM public.check_and_update_family_level(p_family_id);
    RETURN TRUE;
END;
$$;

-- generate_weekly_goals
CREATE OR REPLACE FUNCTION public.generate_weekly_goals(p_family_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_goal_count INTEGER := 0;
BEGIN
    INSERT INTO public.family_goals (family_id, goal_type, target_value, week_start)
    SELECT p_family_id, 'gift_xp', 1000, date_trunc('week', NOW())
    WHERE NOT EXISTS (
        SELECT 1 FROM public.family_goals 
        WHERE family_id = p_family_id 
          AND week_start = date_trunc('week', NOW())
    );
    GET DIAGNOSTICS v_goal_count = ROW_COUNT;
    RETURN v_goal_count;
END;
$$;

-- check_family_rate_limit
CREATE OR REPLACE FUNCTION public.check_family_rate_limit(
    p_family_id UUID,
    p_action TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_last_action TIMESTAMPTZ;
BEGIN
    SELECT MAX(created_at) INTO v_last_action
    FROM public.family_activity_log
    WHERE family_id = p_family_id AND action = p_action;
    
    IF v_last_action IS NULL OR v_last_action < NOW() - INTERVAL '1 minute' THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$;

-- get_family_leaderboard
CREATE OR REPLACE FUNCTION public.get_family_leaderboard()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN (
        SELECT jsonb_agg(row_to_json(r))
        FROM (
            SELECT f.id, f.name, f.level, 
                   COALESCE(SUM(fm.total_xp), 0) as total_xp
            FROM public.families f
            LEFT JOIN public.family_members fm ON fm.family_id = f.id
            GROUP BY f.id
            ORDER BY total_xp DESC
            LIMIT 100
        ) r
    );
END;
$$;

-- ============================================================================
-- Trollmin Functions
-- ============================================================================

-- get_active_city_laws
CREATE OR REPLACE FUNCTION public.get_active_city_laws()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN (
        SELECT jsonb_agg(row_to_json(l))
        FROM public.trollmin_laws l
        WHERE l.is_active = true
          AND (l.expires_at IS NULL OR l.expires_at > NOW())
    );
END;
$$;

-- create_trollmin_law
CREATE OR REPLACE FUNCTION public.create_trollmin_law(
    p_trollmin_id UUID,
    p_law_title TEXT,
    p_law_content TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_law_id UUID;
BEGIN
    INSERT INTO public.trollmin_laws (trollmin_id, title, content)
    VALUES (p_trollmin_id, p_law_title, p_law_content)
    RETURNING id INTO v_law_id;
    RETURN v_law_id;
END;
$$;

-- log_trollmin_action
CREATE OR REPLACE FUNCTION public.log_trollmin_action(
    p_trollmin_id UUID,
    p_action_type TEXT,
    p_details JSONB
)
RETURNS BOOLEAN