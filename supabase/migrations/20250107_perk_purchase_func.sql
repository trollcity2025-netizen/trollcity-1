-- Function to purchase a perk
CREATE OR REPLACE FUNCTION purchase_perk(
    p_perk_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_perk perks%ROWTYPE;
    v_user_tokens INTEGER;
    v_user_level INTEGER;
    v_expires_at TIMESTAMPTZ;
    v_metadata JSONB;
BEGIN
    -- Get Perk Details
    SELECT * INTO v_perk FROM perks WHERE id = p_perk_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Perk not found');
    END IF;

    -- Get User Details
    SELECT perk_tokens, level INTO v_user_tokens, v_user_level 
    FROM user_profiles WHERE id = v_user_id;

    -- Checks
    IF v_user_level < v_perk.required_level THEN
        RETURN jsonb_build_object('success', false, 'error', 'Level requirement not met');
    END IF;

    IF v_user_tokens < v_perk.cost_tokens THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient tokens');
    END IF;

    -- Determine Expiration (from metadata)
    v_metadata := v_perk.metadata;
    IF v_metadata ? 'duration_hours' THEN
        v_expires_at := NOW() + (v_metadata->>'duration_hours')::INTEGER * INTERVAL '1 hour';
    ELSE
        v_expires_at := NULL; -- Permanent
    END IF;

    -- Deduct Tokens
    UPDATE user_profiles 
    SET perk_tokens = perk_tokens - v_perk.cost_tokens 
    WHERE id = v_user_id;

    -- Grant Perk
    INSERT INTO user_perks (user_id, perk_id, expires_at)
    VALUES (v_user_id, p_perk_id, v_expires_at);

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Perk purchased successfully!',
        'remaining_tokens', v_user_tokens - v_perk.cost_tokens
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION purchase_perk(UUID) TO authenticated;
