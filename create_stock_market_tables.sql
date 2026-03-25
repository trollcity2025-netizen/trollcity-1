-- =============================================
-- STOCK MARKET DATABASE SCHEMA
-- Coin Store + Stock Market Hybrid System
-- Idempotent - safe to run multiple times
-- =============================================

-- STOCKS TABLE - Core stock data
CREATE TABLE IF NOT EXISTS stocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_symbol VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('creator', 'family', 'property')),
    entity_id UUID,
    description TEXT,
    base_price DECIMAL(15,2) DEFAULT 100.00,
    current_price DECIMAL(15,2) DEFAULT 100.00,
    previous_price DECIMAL(15,2) DEFAULT 100.00,
    price_change_24h DECIMAL(10,2) DEFAULT 0.00,
    price_change_pct_24h DECIMAL(10,2) DEFAULT 0.00,
    volume BIGINT DEFAULT 0,
    market_cap DECIMAL(20,2) DEFAULT 0,
    high_24h DECIMAL(15,2) DEFAULT 100.00,
    low_24h DECIMAL(15,2) DEFAULT 100.00,
    activity_score DECIMAL(15,2) DEFAULT 0,
    demand_factor DECIMAL(10,4) DEFAULT 1.0000,
    volatility DECIMAL(10,4) DEFAULT 0.0500,
    is_hyped BOOLEAN DEFAULT FALSE,
    hype_ends_at TIMESTAMPTZ,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- USER PORTFOLIO TABLE
CREATE TABLE IF NOT EXISTS user_portfolio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    shares DECIMAL(20,8) DEFAULT 0,
    avg_price DECIMAL(15,2) DEFAULT 0,
    total_invested DECIMAL(20,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, stock_id)
);

-- STOCK TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS stock_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    transaction_type VARCHAR(10) NOT NULL CHECK (transaction_type IN ('buy', 'sell')),
    shares DECIMAL(20,8) NOT NULL,
    price_per_share DECIMAL(15,2) NOT NULL,
    total_amount DECIMAL(20,2) NOT NULL,
    coins_before DECIMAL(20,2) NOT NULL,
    coins_after DECIMAL(20,2) NOT NULL,
    profit_loss DECIMAL(20,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- STOCK PRICE HISTORY
CREATE TABLE IF NOT EXISTS stock_price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    price DECIMAL(15,2) NOT NULL,
    volume BIGINT DEFAULT 0,
    activity_score DECIMAL(15,2) DEFAULT 0,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- STOCK TRADING COOLDOWNS
CREATE TABLE IF NOT EXISTS stock_trade_cooldowns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    last_trade_at TIMESTAMPTZ DEFAULT NOW(),
    trade_count_24h INTEGER DEFAULT 0,
    UNIQUE(user_id, stock_id)
);

-- STOCK MARKET SETTINGS
CREATE TABLE IF NOT EXISTS stock_market_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- STOCK LEADERBOARDS
CREATE TABLE IF NOT EXISTS stock_leaderboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leaderboard_type VARCHAR(50) NOT NULL CHECK (leaderboard_type IN ('richest_investor', 'top_gainer', 'top_trader')),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    value DECIMAL(20,2) NOT NULL,
    rank INTEGER NOT NULL,
    period VARCHAR(20) DEFAULT 'all_time',
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(leaderboard_type, user_id, period)
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_stocks_type ON stocks(type);
CREATE INDEX IF NOT EXISTS idx_stocks_entity_id ON stocks(entity_id);
CREATE INDEX IF NOT EXISTS idx_stocks_is_active ON stocks(is_active);
CREATE INDEX IF NOT EXISTS idx_stocks_current_price ON stocks(current_price);
CREATE INDEX IF NOT EXISTS idx_stocks_price_change_pct_24h ON stocks(price_change_pct_24h);
CREATE INDEX IF NOT EXISTS idx_user_portfolio_user_id ON user_portfolio(user_id);
CREATE INDEX IF NOT EXISTS idx_user_portfolio_stock_id ON user_portfolio(stock_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_user_id ON stock_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_stock_id ON stock_transactions(stock_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_created_at ON stock_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_price_history_stock_id ON stock_price_history(stock_id);
CREATE INDEX IF NOT EXISTS idx_stock_price_history_recorded_at ON stock_price_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_stock_leaderboards_type ON stock_leaderboards(leaderboard_type);
CREATE INDEX IF NOT EXISTS idx_stock_leaderboards_rank ON stock_leaderboards(rank);

-- RLS
ALTER TABLE stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_portfolio ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_trade_cooldowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_market_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_leaderboards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stocks_view_policy" ON stocks;
CREATE POLICY "stocks_view_policy" ON stocks FOR SELECT USING (true);
DROP POLICY IF EXISTS "portfolio_view_policy" ON user_portfolio;
DROP POLICY IF EXISTS "portfolio_insert_policy" ON user_portfolio;
DROP POLICY IF EXISTS "portfolio_update_policy" ON user_portfolio;
DROP POLICY IF EXISTS "portfolio_delete_policy" ON user_portfolio;
CREATE POLICY "portfolio_view_policy" ON user_portfolio FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "portfolio_insert_policy" ON user_portfolio FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "portfolio_update_policy" ON user_portfolio FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "portfolio_delete_policy" ON user_portfolio FOR DELETE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "transactions_view_policy" ON stock_transactions;
DROP POLICY IF EXISTS "transactions_insert_policy" ON stock_transactions;
CREATE POLICY "transactions_view_policy" ON stock_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "transactions_insert_policy" ON stock_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "price_history_view_policy" ON stock_price_history;
CREATE POLICY "price_history_view_policy" ON stock_price_history FOR SELECT USING (true);
DROP POLICY IF EXISTS "cooldowns_policy" ON stock_trade_cooldowns;
CREATE POLICY "cooldowns_policy" ON stock_trade_cooldowns FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "settings_view_policy" ON stock_market_settings;
CREATE POLICY "settings_view_policy" ON stock_market_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "leaderboards_view_policy" ON stock_leaderboards;
CREATE POLICY "leaderboards_view_policy" ON stock_leaderboards FOR SELECT USING (true);

-- SEED SETTINGS
INSERT INTO stock_market_settings (key, value, description) VALUES
    ('trading_cooldown_seconds', '30', 'Cooldown between trades in seconds'),
    ('max_ownership_percent', '10', 'Maximum ownership percentage per user per stock'),
    ('price_update_interval_live', '30', 'Price update interval for live creators (seconds)'),
    ('price_update_interval_general', '180', 'General price update interval (seconds)'),
    ('min_trade_amount', '10', 'Minimum coins required to trade'),
    ('market_hours_start', '00:00', 'Market open time (UTC)'),
    ('market_hours_end', '23:59', 'Market close time (UTC)'),
    ('hype_duration_minutes', '10', 'Duration of hype mode in minutes'),
    ('crash_threshold_inactivity', '3600', 'Inactivity seconds before stock starts crashing'),
    ('crash_rate_per_hour', '5', 'Percentage drop per hour of inactivity')
ON CONFLICT (key) DO NOTHING;

-- FUNCTION: calculate_stock_price
CREATE OR REPLACE FUNCTION calculate_stock_price(
    p_stock_id UUID,
    p_activity_score DECIMAL DEFAULT 0,
    p_demand_factor DECIMAL DEFAULT 1.0,
    p_volatility DECIMAL DEFAULT 0.05
)
RETURNS DECIMAL(15,2)
LANGUAGE plpgsql
AS $$
DECLARE
    v_base_price DECIMAL(15,2);
    v_multiplier DECIMAL(10,4);
    v_new_price DECIMAL(15,2);
BEGIN
    SELECT base_price INTO v_base_price FROM stocks WHERE id = p_stock_id;
    v_multiplier := 1.0 + (p_activity_score / 1000.0) + ((p_demand_factor - 1.0) * 2.0);
    v_multiplier := v_multiplier + (p_volatility * (RANDOM() - 0.5) * 0.1);
    v_new_price := v_base_price * v_multiplier;
    RETURN GREATEST(1.00, ROUND(v_new_price, 2));
END;
$$;

-- FUNCTION: update_stock_price
CREATE OR REPLACE FUNCTION update_stock_price(
    p_stock_id UUID,
    p_activity_score DECIMAL DEFAULT 0,
    p_buy_orders INTEGER DEFAULT 0,
    p_sell_orders INTEGER DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_price DECIMAL(15,2);
    v_new_price DECIMAL(15,2);
    v_demand_factor DECIMAL(10,4);
    v_volatility DECIMAL(10,4);
    v_price_change DECIMAL(10,2);
    v_price_change_pct DECIMAL(10,2);
BEGIN
    SELECT current_price, volatility INTO v_current_price, v_volatility FROM stocks WHERE id = p_stock_id;
    v_demand_factor := 1.0 + ((p_buy_orders - p_sell_orders) * 0.001 * v_volatility);
    v_new_price := calculate_stock_price(p_stock_id, p_activity_score, v_demand_factor, v_volatility);
    v_price_change := v_new_price - v_current_price;
    v_price_change_pct := CASE WHEN v_current_price > 0 THEN (v_price_change / v_current_price) * 100 ELSE 0 END;
    UPDATE stocks SET
        previous_price = current_price,
        current_price = v_new_price,
        price_change_24h = price_change_24h + v_price_change,
        price_change_pct_24h = price_change_pct_24h + v_price_change_pct,
        activity_score = p_activity_score,
        demand_factor = v_demand_factor,
        high_24h = GREATEST(high_24h, v_new_price),
        low_24h = LEAST(low_24h, v_new_price),
        volume = volume + ABS(p_buy_orders + p_sell_orders),
        last_updated = NOW()
    WHERE id = p_stock_id;
END;
$$;

-- FUNCTION: execute_buy_order
CREATE OR REPLACE FUNCTION execute_buy_order(
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
    SELECT current_price INTO v_current_price FROM stocks WHERE id = p_stock_id;
    IF v_current_price IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Stock not found', 0, 0, 0, 0;
        RETURN;
    END IF;
    v_current_price := v_current_price * v_buy_spread;
    SELECT troll_coins INTO v_user_coins FROM user_profiles WHERE id = p_user_id;
    v_fee_amount := p_coins * 0.02;
    v_total_spent := p_coins + v_fee_amount;
    IF v_user_coins < v_total_spent THEN
        RETURN QUERY SELECT FALSE, 'Insufficient coins (fee included)', 0, 0, 0, v_user_coins;
        RETURN;
    END IF;
    v_shares := p_coins / v_current_price;
    SELECT COALESCE(SUM(up.shares), 0), s.market_cap INTO v_total_shares, v_market_cap
    FROM user_portfolio up JOIN stocks s ON s.id = up.stock_id
    WHERE up.user_id = p_user_id AND s.stock_symbol = p_stock_symbol;
    IF v_market_cap > 0 AND v_current_price > 0 THEN
        v_ownership_pct := (v_total_shares / (v_market_cap / v_current_price)) * 100;
        IF v_ownership_pct >= 10 THEN
            RETURN QUERY SELECT FALSE, 'Maximum ownership limit reached (10%)', 0, 0, 0, v_user_coins;
            RETURN;
        END IF;
    END IF;
    UPDATE user_profiles SET troll_coins = troll_coins - v_total_spent WHERE id = p_user_id;
    SELECT id, shares, total_invested INTO v_portfolio_id, v_existing_shares, v_existing_invested
    FROM user_portfolio WHERE user_id = p_user_id AND stock_id = p_stock_id;
    IF v_portfolio_id IS NOT NULL THEN
        v_avg_price := (v_existing_invested + v_total_spent) / (v_existing_shares + v_shares);
        UPDATE user_portfolio SET
            shares = shares + v_shares,
            avg_price = v_avg_price,
            total_invested = total_invested + v_total_spent,
            updated_at = NOW()
        WHERE id = v_portfolio_id;
    ELSE
        INSERT INTO user_portfolio (user_id, stock_id, shares, avg_price, total_invested)
        VALUES (p_user_id, p_stock_id, v_shares, v_current_price, v_total_spent);
    END IF;
    INSERT INTO stock_transactions (user_id, stock_id, transaction_type, shares, price_per_share, total_amount, coins_before, coins_after)
    VALUES (p_user_id, p_stock_id, 'buy', v_shares, v_current_price, v_total_spent, v_user_coins, v_user_coins - v_total_spent);
    UPDATE stocks SET volume = volume + 1 WHERE id = p_stock_id;
    RETURN QUERY SELECT TRUE, 'Purchase successful (2% fee)', v_shares, v_current_price, v_total_spent, v_user_coins - v_total_spent;
END;
$$;

-- FUNCTION: execute_sell_order
CREATE OR REPLACE FUNCTION execute_sell_order(
    p_user_id UUID,
    p_stock_id UUID,
    p_shares DECIMAL(20,8)
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    shares_sold DECIMAL(20,8),
    price_per_share DECIMAL(15,2),
    total_received DECIMAL(20,2),
    profit_loss DECIMAL(20,2),
    coins_remaining DECIMAL(20,2)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_price DECIMAL(15,2);
    v_total_received DECIMAL(20,2);
    v_user_coins DECIMAL(20,2);
    v_portfolio_id UUID;
    v_existing_shares DECIMAL(20,8);
    v_avg_price DECIMAL(15,2);
    v_existing_invested DECIMAL(20,2);
    v_profit_loss DECIMAL(20,2);
    v_fee_amount DECIMAL(20,2);
    v_sell_spread DECIMAL(10,4) := 0.98;
BEGIN
    SELECT current_price INTO v_current_price FROM stocks WHERE id = p_stock_id;
    IF v_current_price IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Stock not found', 0, 0, 0, 0, 0;
        RETURN;
    END IF;
    v_current_price := v_current_price * v_sell_spread;
    SELECT id, shares, avg_price, total_invested INTO v_portfolio_id, v_existing_shares, v_avg_price, v_existing_invested
    FROM user_portfolio WHERE user_id = p_user_id AND stock_id = p_stock_id;
    IF v_portfolio_id IS NULL OR v_existing_shares < p_shares THEN
        SELECT troll_coins INTO v_user_coins FROM user_profiles WHERE id = p_user_id;
        RETURN QUERY SELECT FALSE, 'Insufficient shares', 0, 0, 0, 0, v_user_coins;
        RETURN;
    END IF;
    v_total_received := p_shares * v_current_price;
    v_profit_loss := v_total_received - (p_shares * v_avg_price);
    v_fee_amount := v_total_received * 0.02;
    v_total_received := v_total_received - v_fee_amount;
    SELECT troll_coins INTO v_user_coins FROM user_profiles WHERE id = p_user_id;
    UPDATE user_profiles SET troll_coins = troll_coins + v_total_received WHERE id = p_user_id;
    IF v_existing_shares = p_shares THEN
        DELETE FROM user_portfolio WHERE id = v_portfolio_id;
    ELSE
        UPDATE user_portfolio SET
            shares = shares - p_shares,
            total_invested = total_invested - (p_shares * v_avg_price),
            updated_at = NOW()
        WHERE id = v_portfolio_id;
    END IF;
    INSERT INTO stock_transactions (user_id, stock_id, transaction_type, shares, price_per_share, total_amount, coins_before, coins_after, profit_loss)
    VALUES (p_user_id, p_stock_id, 'sell', p_shares, v_current_price, v_total_received, v_user_coins, v_user_coins + v_total_received, v_profit_loss - v_fee_amount);
    UPDATE stocks SET volume = volume + 1 WHERE id = p_stock_id;
    RETURN QUERY SELECT TRUE, 'Sale successful (2% fee)', p_shares, v_current_price, v_total_received, v_profit_loss - v_fee_amount, v_user_coins + v_total_received;
END;
$$;

-- FUNCTION: get_portfolio_value
CREATE OR REPLACE FUNCTION get_portfolio_value(p_user_id UUID)
RETURNS TABLE(
    stock_symbol VARCHAR,
    stock_name VARCHAR,
    stock_type VARCHAR,
    shares DECIMAL(20,8),
    avg_price DECIMAL(15,2),
    current_price DECIMAL(15,2),
    total_value DECIMAL(20,2),
    profit_loss DECIMAL(20,2),
    profit_loss_pct DECIMAL(10,2)
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY SELECT
        s.stock_symbol, s.name, s.type, up.shares, up.avg_price, s.current_price,
        (up.shares * s.current_price)::DECIMAL(20,2) as total_value,
        ((up.shares * s.current_price) - up.total_invested)::DECIMAL(20,2) as profit_loss,
        CASE WHEN up.total_invested > 0 THEN (((up.shares * s.current_price) - up.total_invested) / up.total_invested * 100)::DECIMAL(10,2) ELSE 0 END as profit_loss_pct
    FROM user_portfolio up JOIN stocks s ON s.id = up.stock_id
    WHERE up.user_id = p_user_id AND up.shares > 0
    ORDER BY total_value DESC;
END;
$$;

-- FUNCTION: get_portfolio_summary
CREATE OR REPLACE FUNCTION get_portfolio_summary(p_user_id UUID)
RETURNS TABLE(
    total_value DECIMAL(20,2),
    total_invested DECIMAL(20,2),
    total_profit_loss DECIMAL(20,2),
    profit_loss_pct DECIMAL(10,2),
    stock_count INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_total_invested DECIMAL(20,2) := 0;
    v_total_value DECIMAL(20,2) := 0;
    v_stock_count INTEGER := 0;
BEGIN
    SELECT COALESCE(SUM(up.total_invested), 0), COALESCE(SUM(up.shares * s.current_price), 0), COUNT(*)
    INTO v_total_invested, v_total_value, v_stock_count
    FROM user_portfolio up JOIN stocks s ON s.id = up.stock_id
    WHERE up.user_id = p_user_id AND up.shares > 0;
    RETURN QUERY SELECT v_total_value, v_total_invested, (v_total_value - v_total_invested),
        CASE WHEN v_total_invested > 0 THEN ((v_total_value - v_total_invested) / v_total_invested * 100) ELSE 0 END,
        v_stock_count;
END;
$$;

-- FUNCTION: check_trade_cooldown
CREATE OR REPLACE FUNCTION check_trade_cooldown(p_user_id UUID, p_stock_id UUID)
RETURNS TABLE(
    can_trade BOOLEAN,
    cooldown_remaining INTEGER,
    message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_last_trade TIMESTAMPTZ;
    v_cooldown_seconds INTEGER := 30;
    v_seconds_since_trade INTEGER;
BEGIN
    SELECT value::INTEGER INTO v_cooldown_seconds FROM stock_market_settings WHERE key = 'trading_cooldown_seconds';
    SELECT last_trade_at INTO v_last_trade FROM stock_trade_cooldowns WHERE user_id = p_user_id AND stock_id = p_stock_id;
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

-- FUNCTION: update_trade_cooldown
CREATE OR REPLACE FUNCTION update_trade_cooldown(p_user_id UUID, p_stock_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO stock_trade_cooldowns (user_id, stock_id, last_trade_at, trade_count_24h)
    VALUES (p_user_id, p_stock_id, NOW(), 1)
    ON CONFLICT (user_id, stock_id) DO UPDATE SET
        last_trade_at = NOW(),
        trade_count_24h = stock_trade_cooldowns.trade_count_24h + 1;
END;
$$;

-- FUNCTION: get_market_stats
CREATE OR REPLACE FUNCTION get_market_stats()
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
AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*)::INTEGER FROM stocks WHERE is_active = TRUE),
        (SELECT COALESCE(SUM(volume), 0)::BIGINT FROM stocks WHERE is_active = TRUE),
        (SELECT COALESCE(AVG(current_price), 0)::DECIMAL(15,2) FROM stocks WHERE is_active = TRUE),
        (SELECT stock_symbol FROM stocks WHERE is_active = TRUE ORDER BY price_change_pct_24h DESC NULLS LAST LIMIT 1),
        (SELECT MAX(price_change_pct_24h)::DECIMAL(10,2) FROM stocks WHERE is_active = TRUE),
        (SELECT stock_symbol FROM stocks WHERE is_active = TRUE ORDER BY volume DESC NULLS LAST LIMIT 1),
        (SELECT MAX(volume)::BIGINT FROM stocks WHERE is_active = TRUE);
END;
$$;

-- FUNCTION: create_stock
CREATE OR REPLACE FUNCTION create_stock(
    p_stock_symbol VARCHAR,
    p_name VARCHAR,
    p_type VARCHAR,
    p_entity_id UUID DEFAULT NULL,
    p_base_price DECIMAL DEFAULT 100.00,
    p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_stock_id UUID;
BEGIN
    IF EXISTS (SELECT 1 FROM stocks WHERE stock_symbol = p_stock_symbol) THEN
        RAISE EXCEPTION 'Stock symbol % already exists', p_stock_symbol;
    END IF;
    INSERT INTO stocks (stock_symbol, name, type, entity_id, base_price, current_price, previous_price, market_cap, description)
    VALUES (p_stock_symbol, p_name, p_type, p_entity_id, p_base_price, p_base_price, p_base_price, p_base_price * 1000000, p_description)
    RETURNING id INTO v_stock_id;
    INSERT INTO stock_price_history (stock_id, price, volume, activity_score) VALUES (v_stock_id, p_base_price, 0, 0);
    RETURN v_stock_id;
END;
$$;

-- FUNCTION: admin_update_stock
CREATE OR REPLACE FUNCTION admin_update_stock(
    p_stock_id UUID,
    p_base_price DECIMAL DEFAULT NULL,
    p_volatility DECIMAL DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT NULL,
    p_is_hyped BOOLEAN DEFAULT NULL,
    p_hype_minutes INTEGER DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE stocks SET
        base_price = COALESCE(p_base_price, base_price),
        volatility = COALESCE(p_volatility, volatility),
        is_active = COALESCE(p_is_active, is_active),
        is_hyped = COALESCE(p_is_hyped, is_hyped),
        hype_ends_at = CASE 
            WHEN p_is_hyped = true AND p_hype_minutes IS NOT NULL THEN NOW() + (p_hype_minutes || ' minutes')::INTERVAL
            WHEN p_is_hyped = false THEN NULL
            ELSE hype_ends_at
        END
    WHERE id = p_stock_id;
    RETURN TRUE;
END;
$$;

-- FUNCTION: admin_get_all_stocks
CREATE OR REPLACE FUNCTION admin_get_all_stocks()
RETURNS TABLE(
    id UUID,
    stock_symbol VARCHAR,
    name VARCHAR,
    type VARCHAR,
    entity_id UUID,
    description TEXT,
    base_price DECIMAL(15,2),
    current_price DECIMAL(15,2),
    price_change_pct_24h DECIMAL(10,2),
    volume BIGINT,
    market_cap DECIMAL(20,2),
    is_hyped BOOLEAN,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY SELECT s.id, s.stock_symbol, s.name, s.type, s.entity_id, s.description, s.base_price, s.current_price, s.price_change_pct_24h, s.volume, s.market_cap, s.is_hyped, s.is_active, s.created_at
    FROM stocks s ORDER BY s.created_at DESC;
END;
$$;

-- FUNCTION: sync_family_stocks
CREATE OR REPLACE FUNCTION sync_family_stocks()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_count INTEGER := 0;
    v_stock_id UUID;
    v_symbol VARCHAR(20);
    v_base_price DECIMAL(15,2);
    v_family_name VARCHAR(100);
BEGIN
    FOR v_stock_id, v_family_name IN
        SELECT tf.id, tf.family_name FROM troll_families tf
        LEFT JOIN stocks s ON s.entity_id = tf.id AND s.type = 'family'
        WHERE s.id IS NULL LIMIT 100
    LOOP
        v_symbol := COALESCE(UPPER(LEFT(REPLACE(v_family_name, ' ', ''), 8)), 'FAMILY');
        v_symbol := '$' || v_symbol;
        IF EXISTS (SELECT 1 FROM stocks WHERE stock_symbol = v_symbol) THEN
            v_symbol := v_symbol || SUBSTRING(MD5(v_stock_id::TEXT) FROM 1 FOR 4);
        END IF;
        SELECT COALESCE(tf.xp / 100.0 + 50.0, 100.0) INTO v_base_price FROM troll_families tf WHERE tf.id = v_stock_id;
        INSERT INTO stocks (stock_symbol, name, type, entity_id, base_price, current_price, previous_price, market_cap, description)
        VALUES (v_symbol, v_family_name, 'family', v_stock_id, v_base_price, v_base_price, v_base_price, v_base_price * 1000000, 'Troll Family')
        ON CONFLICT (stock_symbol) DO NOTHING;
        v_count := v_count + 1;
    END LOOP;
    RETURN v_count;
END;
$$;

-- FUNCTION: sync_creator_stocks
CREATE OR REPLACE FUNCTION sync_creator_stocks()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_count INTEGER := 0;
    v_stock_id UUID;
    v_symbol VARCHAR(20);
    v_base_price DECIMAL(15,2);
    v_username VARCHAR(100);
BEGIN
    FOR v_stock_id, v_username IN
        SELECT up.id, COALESCE(up.username, 'Creator') FROM user_profiles up
        LEFT JOIN stocks s ON s.entity_id = up.id AND s.type = 'creator'
        WHERE s.id IS NULL AND (up.is_broadcaster = true OR up.is_verified = true OR EXISTS (SELECT 1 FROM streams WHERE user_id = up.id AND is_live = true LIMIT 1))
        LIMIT 100
    LOOP
        v_symbol := UPPER(LEFT(REPLACE(v_username, ' ', ''), 8));
        v_symbol := '$' || v_symbol;
        IF EXISTS (SELECT 1 FROM stocks WHERE stock_symbol = v_symbol) THEN
            v_symbol := v_symbol || SUBSTRING(MD5(v_stock_id::TEXT) FROM 1 FOR 4);
        END IF;
        SELECT COALESCE(ul.xp, 0) / 100.0 + 50.0 INTO v_base_price FROM user_levels ul WHERE ul.user_id = v_stock_id;
        IF v_base_price IS NULL OR v_base_price < 10.0 THEN v_base_price := 50.00; END IF;
        INSERT INTO stocks (stock_symbol, name, type, entity_id, base_price, current_price, previous_price, market_cap, description)
        VALUES (v_symbol, v_username, 'creator', v_stock_id, v_base_price, v_base_price, v_base_price, v_base_price * 1000000, 'Creator/Broadcaster')
        ON CONFLICT (stock_symbol) DO NOTHING;
        v_count := v_count + 1;
    END LOOP;
    RETURN v_count;
END;
$$;

-- FUNCTION: sync_property_stocks
CREATE OR REPLACE FUNCTION sync_property_stocks()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_count INTEGER := 0;
    v_stock_id UUID;
    v_symbol VARCHAR(20);
    v_base_price DECIMAL(15,2);
    v_property_name VARCHAR(100);
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_houses' AND column_name = 'is_for_sale') THEN
        RETURN 0;
    END IF;
    FOR v_stock_id, v_property_name, v_base_price IN
        SELECT uh.id, COALESCE(uh.name, 'Property'), COALESCE(uh.price, 100000.00) FROM user_houses uh
        LEFT JOIN stocks s ON s.entity_id = uh.id AND s.type = 'property'
        WHERE s.id IS NULL AND uh.is_for_sale = true LIMIT 100
    LOOP
        v_symbol := COALESCE(UPPER(LEFT(REPLACE(v_property_name, ' ', ''), 6)), 'PROP');
        v_symbol := '$' || v_symbol || '_P';
        IF EXISTS (SELECT 1 FROM stocks WHERE stock_symbol = v_symbol) THEN
            v_symbol := v_symbol || SUBSTRING(MD5(v_stock_id::TEXT) FROM 1 FOR 4);
        END IF;
        v_base_price := COALESCE(v_base_price / 1000.0, 100.00);
        INSERT INTO stocks (stock_symbol, name, type, entity_id, base_price, current_price, previous_price, market_cap, description)
        VALUES (v_symbol, v_property_name, 'property', v_stock_id, v_base_price, v_base_price, v_base_price, v_base_price * 1000000, 'Property')
        ON CONFLICT (stock_symbol) DO NOTHING;
        v_count := v_count + 1;
    END LOOP;
    RETURN v_count;
END;
$$;

-- FUNCTION: sync_all_stocks
CREATE OR REPLACE FUNCTION sync_all_stocks()
RETURNS TABLE(
    families_synced INTEGER,
    creators_synced INTEGER,
    properties_synced INTEGER,
    total_synced INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_families INTEGER;
    v_creators INTEGER;
    v_properties INTEGER;
BEGIN
    v_families := sync_family_stocks();
    v_creators := sync_creator_stocks();
    v_properties := sync_property_stocks();
    RETURN QUERY SELECT v_families, v_creators, v_properties, v_families + v_creators + v_properties;
END;
$$;

-- Run sync
SELECT sync_all_stocks();
