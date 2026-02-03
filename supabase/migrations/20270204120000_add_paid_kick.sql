-- Function to handle paid kicks (100 coins)
-- Kicker pays 100 coins, Target is banned for 24 hours (unless they pay to return)

CREATE OR REPLACE FUNCTION kick_user_paid(p_stream_id TEXT, p_target_user_id UUID, p_kicker_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_cost INTEGER := 100;
    v_balance INTEGER;
BEGIN
    -- Check balance
    SELECT coins INTO v_balance FROM user_profiles WHERE id = p_kicker_id;
    
    IF v_balance IS NULL OR v_balance < v_cost THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds (100 coins required)');
    END IF;

    -- Deduct coins
    UPDATE user_profiles SET coins = coins - v_cost WHERE id = p_kicker_id;

    -- Add to kick/ban list (temporary ban for 24 hours)
    -- We use ON CONFLICT to update expiry if already kicked
    INSERT INTO stream_bans (stream_id, user_id, banned_by, reason, expires_at)
    VALUES (p_stream_id, p_target_user_id, p_kicker_id, 'Paid Kick', NOW() + INTERVAL '24 hours')
    ON CONFLICT (stream_id, user_id) 
    DO UPDATE SET expires_at = NOW() + INTERVAL '24 hours', banned_by = p_kicker_id;

    -- Remove from viewers
    DELETE FROM stream_viewers WHERE stream_id = p_stream_id AND user_id = p_target_user_id;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for a kicked user to pay to return
-- Cost: Maybe 100 coins? Or 50? Prompt says "kick fee page to get back into that broadcast if they dont pay".
-- Let's assume the fee to return is also 100 coins.

CREATE OR REPLACE FUNCTION pay_kick_fee(p_stream_id TEXT, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_cost INTEGER := 100;
    v_balance INTEGER;
BEGIN
    -- Check balance
    SELECT coins INTO v_balance FROM user_profiles WHERE id = p_user_id;
    
    IF v_balance IS NULL OR v_balance < v_cost THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds to pay kick fee');
    END IF;

    -- Deduct coins
    UPDATE user_profiles SET coins = coins - v_cost WHERE id = p_user_id;

    -- Remove from bans
    DELETE FROM stream_bans WHERE stream_id = p_stream_id AND user_id = p_user_id;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
