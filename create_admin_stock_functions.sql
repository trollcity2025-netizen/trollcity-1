-- =============================================
-- ADMIN STOCK MANAGEMENT FUNCTIONS
-- For CEO/Admin to create and manage stocks
-- =============================================

-- Function to create a new stock (admin function)
CREATE OR REPLACE FUNCTION create_stock(
    p_stock_symbol VARCHAR,
    p_name VARCHAR,
    p_type VARCHAR,
    p_entity_id UUID DEFAULT NULL,
    p_base_price DECIMAL DEFAULT 100.00,
    p_description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_stock_id UUID;
BEGIN
    -- Check if stock symbol already exists
    IF EXISTS (SELECT 1 FROM stocks WHERE stock_symbol = p_stock_symbol) THEN
        RAISE EXCEPTION 'Stock symbol % already exists', p_stock_symbol;
    END IF;
    
    INSERT INTO stocks (stock_symbol, name, type, entity_id, base_price, current_price, previous_price, market_cap, description)
    VALUES (p_stock_symbol, p_name, p_type, p_entity_id, p_base_price, p_base_price, p_base_price, p_base_price * 1000000, p_description)
    RETURNING id INTO v_stock_id;
    
    -- Create initial price history
    INSERT INTO stock_price_history (stock_id, price, volume, activity_score)
    VALUES (v_stock_id, p_base_price, 0, 0);
    
    RETURN v_stock_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update stock (admin function)
CREATE OR REPLACE FUNCTION admin_update_stock(
    p_stock_id UUID,
    p_base_price DECIMAL DEFAULT NULL,
    p_volatility DECIMAL DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT NULL,
    p_is_hyped BOOLEAN DEFAULT NULL,
    p_hype_minutes INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
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
$$ LANGUAGE plpgsql;

-- Function to get all stocks for admin (includes inactive)
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
) AS $$
BEGIN
    RETURN QUERY SELECT
        s.id,
        s.stock_symbol,
        s.name,
        s.type,
        s.entity_id,
        s.description,
        s.base_price,
        s.current_price,
        s.price_change_pct_24h,
        s.volume,
        s.market_cap,
        s.is_hyped,
        s.is_active,
        s.created_at
    FROM stocks s
    ORDER BY s.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to activate hype mode (admin)
CREATE OR REPLACE FUNCTION admin_activate_hype(
    p_stock_id UUID,
    p_minutes INTEGER DEFAULT 10
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE stocks SET
        is_hyped = true,
        hype_ends_at = NOW() + (p_minutes || ' minutes')::INTERVAL
    WHERE id = p_stock_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to deactivate hype mode (admin)
CREATE OR REPLACE FUNCTION admin_deactivate_hype(
    p_stock_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE stocks SET
        is_hyped = false,
        hype_ends_at = NULL
    WHERE id = p_stock_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to reset stock price (admin)
CREATE OR REPLACE FUNCTION admin_reset_stock_price(
    p_stock_id UUID,
    p_new_base_price DECIMAL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_price DECIMAL(15,2);
BEGIN
    -- Get current price
    SELECT current_price INTO v_current_price FROM stocks WHERE id = p_stock_id;
    
    -- Update stock with new base price
    UPDATE stocks SET
        base_price = p_new_base_price,
        current_price = p_new_base_price,
        previous_price = v_current_price,
        price_change_24h = 0,
        price_change_pct_24h = 0,
        high_24h = p_new_base_price,
        low_24h = p_new_base_price
    WHERE id = p_stock_id;
    
    -- Record the reset in price history
    INSERT INTO stock_price_history (stock_id, price, volume, activity_score)
    VALUES (p_stock_id, p_new_base_price, 0, 0);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to get stock statistics (admin)
CREATE OR REPLACE FUNCTION admin_get_stock_stats(p_stock_id UUID)
RETURNS TABLE(
    stock_symbol VARCHAR,
    total_shares BIGINT,
    total_invested DECIMAL(20,2),
    holder_count INTEGER,
    total_transactions BIGINT,
    avg_price DECIMAL(15,2)
) AS $$
BEGIN
    RETURN QUERY SELECT
        s.stock_symbol,
        COALESCE(SUM(up.shares), 0)::BIGINT as total_shares,
        COALESCE(SUM(up.total_invested), 0) as total_invested,
        COUNT(DISTINCT up.user_id)::INTEGER as holder_count,
        COUNT(st.id)::BIGINT as total_transactions,
        COALESCE(AVG(st.price_per_share), 0) as avg_price
    FROM stocks s
    LEFT JOIN user_portfolio up ON up.stock_id = s.id AND up.shares > 0
    LEFT JOIN stock_transactions st ON st.stock_id = s.id
    WHERE s.id = p_stock_id
    GROUP BY s.id, s.stock_symbol;
END;
$$ LANGUAGE plpgsql;
