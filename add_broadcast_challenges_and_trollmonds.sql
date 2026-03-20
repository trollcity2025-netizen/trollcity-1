-- ============================================================================
-- BROADCAST CHALLENGES & TROLLMONDS GIFT DISCOUNT SYSTEM
-- ============================================================================
-- This migration adds:
-- 1. broadcast_challenges table - for viewer-initiated challenges
-- 2. Updates to battles table - sudden death and rematch features
-- 3. trollmonds_balance column in user_profiles
-- 4. send_challenge_gift function - discounted gifting during challenges
-- ============================================================================

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- BROADCAST_CHALLENGES TABLE
-- ============================================================================
-- Stores viewer-initiated challenges to broadcasters

CREATE TABLE IF NOT EXISTS broadcast_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
    challenger_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    challenger_username TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'denied', 'expired', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
    accepted_at TIMESTAMPTZ,
    denied_at TIMESTAMPTZ,
    
    -- Track which challenge was accepted (for when multiple exist)
    is_active BOOLEAN DEFAULT FALSE
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_broadcast_challenges_stream_id 
    ON broadcast_challenges(stream_id) 
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_broadcast_challenges_challenger_id 
    ON broadcast_challenges(challenger_id);

CREATE INDEX IF NOT EXISTS idx_broadcast_challenges_status 
    ON broadcast_challenges(status) 
    WHERE status IN ('pending', 'accepted');

-- ============================================================================
-- UPDATE BATTLES TABLE - Add sudden death and rematch columns
-- ============================================================================

ALTER TABLE battles 
    ADD COLUMN IF NOT EXISTS is_sudden_death BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS rematch_requested BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS rematch_status TEXT DEFAULT 'none' CHECK (rematch_status IN ('none', 'requested', 'accepted', 'denied')),
    ADD COLUMN IF NOT EXISTS sudden_death_started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS challenge_id UUID REFERENCES broadcast_challenges(id);

-- ============================================================================
-- TROLLMONDS BALANCE - Add to user_profiles if not exists
-- ============================================================================

ALTER TABLE user_profiles 
    ADD COLUMN IF NOT EXISTS trollmonds_balance INTEGER DEFAULT 0;

-- ============================================================================
-- SEND_CHALLENGE_GIFT FUNCTION
-- ============================================================================
-- Handles discounted gifting during challenges:
-- - Sender gets 10% discount (configurable)
-- - Receiver gets full Trollmonds value
-- - Deducted from receiver's Trollmonds balance

CREATE OR REPLACE FUNCTION send_challenge_gift(
    p_sender_id UUID,
    p_receiver_id UUID,
    p_gift_id UUID,
    p_discount_percent DECIMAL DEFAULT 0.10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_gift_cost INTEGER;
    v_sender_payment INTEGER;
    v_receiver_value INTEGER;
    v_sender_coins INTEGER;
    v_result JSONB;
BEGIN
    -- Get gift cost from gift_shop
    SELECT price INTO v_gift_cost 
    FROM gift_shop 
    WHERE id = p_gift_id;

    IF v_gift_cost IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Gift not found'
        );
    END IF;

    -- Check sender has enough coins (after discount)
    SELECT coins INTO v_sender_coins 
    FROM user_profiles 
    WHERE id = p_sender_id;

    -- Calculate sender payment (with discount)
    v_sender_payment := CAST(v_gift_cost * (1 - p_discount_percent) AS INTEGER);
    
    -- Receiver gets full value
    v_receiver_value := v_gift_cost;

    -- Check sender has enough
    IF v_sender_coins < v_sender_payment THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient coins',
            'required', v_sender_payment,
            'available', v_sender_coins
        );
    END IF;

    -- Deduct coins from sender
    UPDATE user_profiles 
    SET coins = coins - v_sender_payment,
        updated_at = NOW()
    WHERE id = p_sender_id;

    -- Add Trollmonds to receiver (full value)
    UPDATE user_profiles 
    SET trollmonds_balance = COALESCE(trollmonds_balance, 0) + v_receiver_value,
        updated_at = NOW()
    WHERE id = p_receiver_id;

    -- Log the gift transaction
    INSERT INTO stream_gifts (
        stream_id,
        sender_id,
        recipient_id,
        gift_id,
        amount,
        created_at
    )
    SELECT 
        s.id,
        p_sender_id,
        p_receiver_id,
        p_gift_id,
        v_sender_payment,
        NOW()
    FROM streams s
    WHERE s.user_id = p_receiver_id
    LIMIT 1;

    RETURN jsonb_build_object(
        'success', true,
        'sender_paid', v_sender_payment,
        'sender_saved', v_gift_cost - v_sender_payment,
        'receiver_got', v_receiver_value
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;

-- ============================================================================
-- AWARD_CHALLENGE_CROWNS FUNCTION
-- ============================================================================
-- Awards 2 crowns to each participant on winning team

CREATE OR REPLACE FUNCTION award_challenge_crowns(
    p_battle_id UUID,
    p_winner_team TEXT -- 'challenger' or 'opponent'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_battle RECORD;
    v_winner_stream_id UUID;
    v_winner_user_ids UUID[];
    v_participant_count INTEGER;
    v_crowns_awarded INTEGER;
BEGIN
    -- Get battle info
    SELECT * INTO v_battle FROM battles WHERE id = p_battle_id;
    
    IF v_battle IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Battle not found');
    END IF;

    -- Determine winner's stream ID
    IF p_winner_team = 'challenger' THEN
        v_winner_stream_id := v_battle.challenger_stream_id;
    ELSE
        v_winner_stream_id := v_battle.opponent_stream_id;
    END IF;

    -- Get all participants from winner's stream (host + guests)
    -- Host
    SELECT array_agg(user_id) INTO v_winner_user_ids
    FROM stream_seats
    WHERE stream_id = v_winner_stream_id;
    
    -- Add host if not already included
    IF v_battle.challenger_stream_id = v_winner_stream_id THEN
        SELECT array_cat(v_winner_user_ids, ARRAY[streams.user_id])
        INTO v_winner_user_ids
        FROM streams WHERE id = v_winner_stream_id;
    END IF;

    -- Count participants
    v_participant_count := COALESCE(array_length(v_winner_user_ids, 1), 0);
    
    -- Award 2 crowns per participant
    v_crowns_awarded := v_participant_count * 2;

    -- Update each participant's crown count
    FOR i IN 1..array_length(v_winner_user_ids, 1) LOOP
        UPDATE user_profiles
        SET battle_crowns = COALESCE(battle_crowns, 0) + 2,
            updated_at = NOW()
        WHERE id = v_winner_user_ids[i];
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'winner_team', p_winner_team,
        'participants', v_participant_count,
        'crowns_per_participant', 2,
        'total_crowns_awarded', v_crowns_awarded
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================================================
-- CLEANUP: Set expired challenges to expired status
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_challenges()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE broadcast_challenges
    SET status = 'expired'
    WHERE status = 'pending'
    AND expires_at < NOW();
END;
$$;

-- Schedule cleanup (optional - can be run as cron job)
-- SELECT cleanup_expired_challenges();

-- ============================================================================
-- GRANTS (adjust as needed for your RLS policies)
-- ============================================================================

-- Grant permissions (adjust based on your auth setup)
-- GRANT ALL ON broadcast_challenges TO authenticated;
-- GRANT ALL ON broadcast_challenges TO anon;
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE broadcast_challenges IS 'Stores viewer-initiated challenges to broadcasters';
COMMENT ON COLUMN broadcast_challenges.stream_id IS 'The broadcaster''s stream being challenged';
COMMENT ON COLUMN broadcast_challenges.challenger_id IS 'The viewer who initiated the challenge';
COMMENT ON COLUMN broadcast_challenges.status IS 'pending/accepted/denied/expired/cancelled';
COMMENT ON COLUMN broadcast_challenges.is_active IS 'Which challenge was accepted (when multiple exist)';

COMMENT ON TABLE user_profiles IS 'Added trollmonds_balance for Trollmonds currency';
COMMENT ON COLUMN user_profiles.trollmonds_balance IS 'User''s Trollmonds currency balance';

COMMENT ON FUNCTION send_challenge_gift IS 'Handles discounted gifting: sender gets 10% off, receiver gets full Trollmonds value';
COMMENT ON FUNCTION award_challenge_crowns IS 'Awards 2 crowns to each participant on winning team';

-- ============================================================================
-- DONE
-- ============================================================================

SELECT 
    'Migration completed successfully!' AS status,
    NOW() AS executed_at;

-- Verify tables exist
SELECT 
    'broadcast_challenges' AS table_name,
    COUNT(*) AS columns
FROM information_schema.columns
WHERE table_name = 'broadcast_challenges';

SELECT 
    'battles' AS table_name,
    COUNT(*) AS columns
FROM information_schema.columns
WHERE table_name = 'battles'
AND column_name IN ('is_sudden_death', 'rematch_requested', 'rematch_status');
