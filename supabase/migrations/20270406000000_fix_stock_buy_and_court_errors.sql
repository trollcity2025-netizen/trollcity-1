-- Fix multiple database issues for stock trading and court system
-- Run this against the Supabase database

-- 0. Fix jail table foreign key if missing (PGRST200 error)
-- First delete orphaned jail records where user_id doesn't exist in user_profiles
DO $$
BEGIN
    DELETE FROM public.jail WHERE user_id NOT IN (SELECT id FROM public.user_profiles);
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'jail_user_id_fkey'
        AND table_name = 'jail'
    ) THEN
        ALTER TABLE public.jail
        ADD CONSTRAINT jail_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.user_profiles(id)
        ON DELETE CASCADE;
    END IF;
END $$;

-- 1. Ensure court_summons has proper case_id column (UUID type)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_summons' AND column_name = 'case_id') THEN
        ALTER TABLE court_summons ADD COLUMN case_id UUID;
    END IF;
    
    -- If case_id exists but is wrong type, fix it
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_summons' AND column_name = 'case_id' AND data_type != 'uuid') THEN
        ALTER TABLE court_summons DROP COLUMN IF EXISTS case_id;
        ALTER TABLE court_summons ADD COLUMN case_id UUID;
    END IF;
END $$;

-- 2. Skip adding FK constraint - will be handled by separate migration if needed

-- 3. Fix get_market_stats function with proper handling
CREATE OR REPLACE FUNCTION public.get_market_stats()
RETURNS TABLE(
    total_stocks INTEGER,
    total_volume BIGINT,
    avg_price DECIMAL(15,2),
    top_gainer_stock VARCHAR,
    top_gainer_change DECIMAL(10,2),
    most_traded_stock VARCHAR,
    most_traded_volume BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*)::INTEGER FROM public.stocks WHERE is_active = TRUE),
        (SELECT COALESCE(SUM(volume), 0)::BIGINT FROM public.stocks WHERE is_active = TRUE),
        (SELECT COALESCE(AVG(current_price), 0)::DECIMAL(15,2) FROM public.stocks WHERE is_active = TRUE),
        (SELECT stock_symbol FROM public.stocks WHERE is_active = TRUE ORDER BY price_change_pct_24h DESC NULLS LAST LIMIT 1),
        (SELECT MAX(price_change_pct_24h)::DECIMAL(10,2) FROM public.stocks WHERE is_active = TRUE),
        (SELECT stock_symbol FROM public.stocks WHERE is_active = TRUE ORDER BY volume DESC NULLS LAST LIMIT 1),
        (SELECT MAX(volume)::BIGINT FROM public.stocks WHERE is_active = TRUE);
END;
$$;

-- 4. Fix execute_buy_order function - ensure proper parameter types
CREATE OR REPLACE FUNCTION public.execute_buy_order(
    p_user_id UUID,
    p_stock_id UUID,
    p_coins DECIMAL(20,2),
    p_stock_symbol VARCHAR
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    shares_purchased DECIMAL(20,8),
    price_per_share DECIMAL(15,2),
    total_spent DECIMAL(20,2),
    coins_remaining DECIMAL(20,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_current_price DECIMAL(15,2);
    v_shares DECIMAL(20,8);
    v_total_spent DECIMAL(20,2);
    v_user_coins DECIMAL(20,2);
    v_portfolio_id UUID;
    v_avg_price DECIMAL(15,2);
    v_existing_shares DECIMAL(20,8);
    v_existing_invested DECIMAL(20,2);
    v_total_shares DECIMAL(20,8);
    v_market_cap DECIMAL(20,2);
    v_ownership_pct DECIMAL(10,2);
    v_fee_amount DECIMAL(20,2);
    v_buy_spread DECIMAL(10,4) := 1.02;
BEGIN
    SELECT current_price INTO v_current_price FROM public.stocks WHERE id = p_stock_id;
    IF v_current_price IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Stock not found', 0, 0, 0, 0;
        RETURN;
    END IF;
    v_current_price := v_current_price * v_buy_spread;
    SELECT troll_coins INTO v_user_coins FROM public.user_profiles WHERE id = p_user_id;
    v_fee_amount := p_coins * 0.02;
    v_total_spent := p_coins + v_fee_amount;
    IF v_user_coins < v_total_spent THEN
        RETURN QUERY SELECT FALSE, 'Insufficient coins (fee included)', 0, 0, 0, v_user_coins;
        RETURN;
    END IF;
    v_shares := p_coins / v_current_price;
    SELECT COALESCE(SUM(up.shares), 0) INTO v_total_shares
    FROM public.user_portfolio up 
    JOIN public.stocks s ON s.id = up.stock_id
    WHERE up.user_id = p_user_id AND s.stock_symbol = p_stock_symbol;
    SELECT market_cap INTO v_market_cap FROM public.stocks WHERE stock_symbol = p_stock_symbol;
    IF v_market_cap > 0 AND v_current_price > 0 THEN
        v_ownership_pct := (v_total_shares / (v_market_cap / v_current_price)) * 100;
        IF v_ownership_pct >= 10 THEN
            RETURN QUERY SELECT FALSE, 'Maximum ownership limit reached (10%)', 0, 0, 0, v_user_coins;
            RETURN;
        END IF;
    END IF;
    UPDATE public.user_profiles SET troll_coins = troll_coins - v_total_spent WHERE id = p_user_id;
    SELECT id, shares, total_invested INTO v_portfolio_id, v_existing_shares, v_existing_invested
    FROM public.user_portfolio WHERE user_id = p_user_id AND stock_id = p_stock_id;
    IF v_portfolio_id IS NOT NULL THEN
        v_avg_price := (v_existing_invested + v_total_spent) / (v_existing_shares + v_shares);
        UPDATE public.user_portfolio SET
            shares = shares + v_shares,
            avg_price = v_avg_price,
            total_invested = total_invested + v_total_spent,
            updated_at = NOW()
        WHERE id = v_portfolio_id;
    ELSE
        INSERT INTO public.user_portfolio (user_id, stock_id, shares, avg_price, total_invested)
        VALUES (p_user_id, p_stock_id, v_shares, v_current_price, v_total_spent);
    END IF;
    INSERT INTO public.stock_transactions (user_id, stock_id, transaction_type, shares, price_per_share, total_amount, coins_before, coins_after)
    VALUES (p_user_id, p_stock_id, 'buy', v_shares, v_current_price, v_total_spent, v_user_coins, v_user_coins - v_total_spent);
    UPDATE public.stocks SET 
        volume = volume + v_shares,
        last_updated = NOW()
    WHERE id = p_stock_id;
    RETURN QUERY SELECT TRUE, 'Purchase successful', v_shares, v_current_price, v_total_spent, v_user_coins - v_total_spent;
END;
$$;

-- 5. Fix check_trade_cooldown with proper parameter types
CREATE OR REPLACE FUNCTION public.check_trade_cooldown(
    p_user_id UUID, 
    p_stock_id UUID
)
RETURNS TABLE(
    can_trade BOOLEAN,
    cooldown_remaining INTEGER,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_last_trade TIMESTAMPTZ;
    v_cooldown_seconds INTEGER := 30;
    v_seconds_since_trade INTEGER;
BEGIN
    SELECT value::INTEGER INTO v_cooldown_seconds FROM public.stock_market_settings WHERE key = 'trading_cooldown_seconds';
    SELECT last_trade_at INTO v_last_trade FROM public.stock_trade_cooldowns WHERE user_id = p_user_id AND stock_id = p_stock_id;
    IF v_last_trade IS NULL THEN
        RETURN QUERY SELECT TRUE, 0, 'Can trade';
        RETURN;
    END IF;
    v_seconds_since_trade := EXTRACT(EPOCH FROM (NOW() - v_last_trade))::INTEGER;
    IF v_seconds_since_trade >= v_cooldown_seconds THEN
        RETURN QUERY SELECT TRUE, 0, 'Can trade';
    ELSE
        RETURN QUERY SELECT FALSE, v_cooldown_seconds - v_seconds_since_trade, format('Please wait %s seconds before trading this stock again', v_cooldown_seconds - v_seconds_since_trade);
    END IF;
END;
$$;

-- 6. Fix admin_get_all_stocks
CREATE OR REPLACE FUNCTION public.admin_get_all_stocks()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN (
        SELECT jsonb_agg(row_to_json(s))
        FROM (
            SELECT id, stock_symbol, name, type, entity_id, description, 
                   base_price, current_price, price_change_pct_24h, volume, 
                   market_cap, is_hyped, is_active, created_at
            FROM public.stocks
            ORDER BY created_at DESC
        ) s
    );
END;
$$;

-- 7. Ensure the stocks table has market_cap column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stocks' AND column_name = 'market_cap') THEN
        ALTER TABLE stocks ADD COLUMN market_cap DECIMAL(20,2) DEFAULT 0;
    END IF;
END $$;

-- 8. Ensure user_portfolio table exists with correct schema
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_portfolio') THEN
        CREATE TABLE IF NOT EXISTS user_portfolio (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            stock_id UUID REFERENCES stocks(id) ON DELETE CASCADE,
            shares DECIMAL(20,8) DEFAULT 0,
            avg_price DECIMAL(15,2),
            total_invested DECIMAL(20,2) DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(user_id, stock_id)
        );
    END IF;
END $$;

-- 9. Ensure stock_transactions table exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_transactions') THEN
        CREATE TABLE IF NOT EXISTS stock_transactions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            stock_id UUID REFERENCES stocks(id) ON DELETE CASCADE,
            transaction_type VARCHAR(10) CHECK (transaction_type IN ('buy', 'sell')),
            shares DECIMAL(20,8),
            price_per_share DECIMAL(15,2),
            total_amount DECIMAL(20,2),
            coins_before DECIMAL(20,2),
            coins_after DECIMAL(20,2),
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;
END $$;

-- 10. Ensure stock_trade_cooldowns table exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_trade_cooldowns') THEN
        CREATE TABLE IF NOT EXISTS stock_trade_cooldowns (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            stock_id UUID REFERENCES stocks(id) ON DELETE CASCADE,
            last_trade_at TIMESTAMPTZ DEFAULT NOW(),
            trade_count_24h INTEGER DEFAULT 0,
            UNIQUE(user_id, stock_id)
        );
    END IF;
END $$;

-- 11. Ensure stock_market_settings table exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_market_settings') THEN
        CREATE TABLE IF NOT EXISTS stock_market_settings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            key VARCHAR(100) UNIQUE,
            value TEXT,
            description TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        INSERT INTO stock_market_settings (key, value, description) VALUES 
            ('trading_cooldown_seconds', '30', 'Cooldown between trades in seconds'),
            ('max_ownership_pct', '10', 'Maximum ownership percentage allowed');
    END IF;
END $$;

DO $$
BEGIN
    RAISE NOTICE 'Database fixes applied successfully';
END $$;
