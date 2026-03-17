-- Migration: Update Trollmin entry cost from 100000 to 5000 and support up to 5 trillion
-- Date: 2026-03-17

-- Drop old function if exists to avoid overload conflict
DROP FUNCTION IF EXISTS join_trollmin_queue(UUID, VARCHAR, INTEGER);

-- Update column types to BIGINT to support up to 5 trillion coins
ALTER TABLE trollmin_queue ALTER COLUMN coins_spent TYPE BIGINT;
ALTER TABLE trollmin_queue ALTER COLUMN bid_amount TYPE BIGINT;

-- Update the join_trollmin_queue function to use new entry cost and BIGINT
CREATE OR REPLACE FUNCTION join_trollmin_queue(p_user_id UUID, p_username VARCHAR, p_coins BIGINT)
RETURNS JSONB AS $$
DECLARE
    v_entry_cost BIGINT := 5000;
    v_result JSONB;
    v_position INTEGER;
    v_existing_queue RECORD;
BEGIN
    SELECT * INTO v_existing_queue 
    FROM trollmin_queue 
    WHERE user_id = p_user_id AND status = 'waiting';
    
    IF FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Already in queue');
    END IF;
    
    IF EXISTS (SELECT 1 FROM trollmin_queue WHERE user_id = p_user_id AND is_banned_from_queue = true) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Banned from Power Queue');
    END IF;
    
    IF p_coins < v_entry_cost THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not enough coins. Need ' || v_entry_cost);
    END IF;
    
    SELECT COALESCE(MAX(queue_position), 0) + 1 INTO v_position FROM trollmin_queue WHERE status = 'waiting';
    
    INSERT INTO trollmin_queue (user_id, username, coins_spent, queue_position, status)
    VALUES (p_user_id, p_username, v_entry_cost, v_position, 'waiting')
    RETURNING jsonb_build_object(
        'success', true,
        'position', queue_position,
        'coins_spent', coins_spent
    ) INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;
