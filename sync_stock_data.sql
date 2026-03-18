-- Sync stocks with existing troll families, creators, and properties
-- Run this file to populate stocks from existing database data

-- First, clear existing stocks to get fresh data
DELETE FROM stock_transactions;
DELETE FROM stock_price_history;
DELETE FROM user_portfolio;
DELETE FROM stocks;

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
    v_market_cap DECIMAL(20,2);
    v_family_name VARCHAR(100);
BEGIN
    FOR v_stock_id, v_family_name, v_base_price, v_market_cap IN
        SELECT tf.id, tf.family_name, 
               COALESCE(tf.xp / 100.0 + 50.0, 100.0),
               COALESCE(tf.xp * 10.0, 10000.0)
        FROM troll_families tf
        WHERE tf.xp IS NOT NULL
        LIMIT 100
    LOOP
        v_symbol := COALESCE(UPPER(LEFT(REPLACE(v_family_name, ' ', ''), 8)), 'FAMILY');
        v_symbol := '$' || v_symbol;
        IF EXISTS (SELECT 1 FROM stocks WHERE stock_symbol = v_symbol) THEN
            v_symbol := v_symbol || SUBSTRING(MD5(v_stock_id::TEXT) FROM 1 FOR 4);
        END IF;
        INSERT INTO stocks (stock_symbol, name, type, entity_id, base_price, current_price, previous_price, market_cap, description)
        VALUES (v_symbol, v_family_name, 'family', v_stock_id, v_base_price, v_base_price, v_base_price, v_market_cap, 'Troll Family')
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
    v_market_cap DECIMAL(20,2);
    v_username VARCHAR(100);
BEGIN
    FOR v_stock_id, v_username, v_base_price, v_market_cap IN
        SELECT up.id, COALESCE(up.username, 'Creator'),
               COALESCE(ul.xp, 0) / 100.0 + 50.0,
               COALESCE(ul.xp * 10.0, 10000.0)
        FROM user_profiles up
        LEFT JOIN user_levels ul ON ul.user_id = up.id
        WHERE up.is_broadcaster = true OR up.is_verified = true OR EXISTS (SELECT 1 FROM streams WHERE user_id = up.id AND is_live = true LIMIT 1)
        LIMIT 100
    LOOP
        v_symbol := UPPER(LEFT(REPLACE(v_username, ' ', ''), 8));
        v_symbol := '$' || v_symbol;
        IF EXISTS (SELECT 1 FROM stocks WHERE stock_symbol = v_symbol) THEN
            v_symbol := v_symbol || SUBSTRING(MD5(v_stock_id::TEXT) FROM 1 FOR 4);
        END IF;
        IF v_base_price IS NULL OR v_base_price < 10.0 THEN v_base_price := 50.00; END IF;
        IF v_market_cap IS NULL OR v_market_cap < 1000.0 THEN v_market_cap := 10000.00; END IF;
        INSERT INTO stocks (stock_symbol, name, type, entity_id, base_price, current_price, previous_price, market_cap, description)
        VALUES (v_symbol, v_username, 'creator', v_stock_id, v_base_price, v_base_price, v_base_price, v_market_cap, 'Creator/Broadcaster')
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
    v_market_cap DECIMAL(20,2);
    v_property_name VARCHAR(100);
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_houses' AND column_name = 'is_for_sale')
       OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_houses' AND column_name = 'price') THEN
        RETURN 0;
    END IF;
    FOR v_stock_id, v_property_name, v_base_price, v_market_cap IN
        SELECT uh.id, COALESCE(uh.name, 'Property'), 
               COALESCE(uh.price / 1000.0, 100.00),
               COALESCE(uh.price, 100000.00)
        FROM user_houses uh
        WHERE COALESCE(uh.is_for_sale, false) = true LIMIT 100
    LOOP
        v_symbol := COALESCE(UPPER(LEFT(REPLACE(v_property_name, ' ', ''), 6)), 'PROP');
        v_symbol := '$' || v_symbol || '_P';
        IF EXISTS (SELECT 1 FROM stocks WHERE stock_symbol = v_symbol) THEN
            v_symbol := v_symbol || SUBSTRING(MD5(v_stock_id::TEXT) FROM 1 FOR 4);
        END IF;
        INSERT INTO stocks (stock_symbol, name, type, entity_id, base_price, current_price, previous_price, market_cap, description)
        VALUES (v_symbol, v_property_name, 'property', v_stock_id, v_base_price, v_base_price, v_base_price, v_market_cap, 'Property')
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
