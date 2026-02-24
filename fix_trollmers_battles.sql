-- Fix Trollmers Head-to-Head Battles
-- Run these SQL commands directly in Supabase SQL Editor

-- Fix 1: Update is_trollmers_eligible to require only 1 follower instead of 100
CREATE OR REPLACE FUNCTION public.is_trollmers_eligible(
    p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_followers_count INTEGER;
    v_user_role TEXT;
BEGIN
    -- Check if user is admin (bypass follower requirement)
    SELECT role INTO v_user_role
    FROM public.user_profiles
    WHERE id = p_user_id;

    IF v_user_role = 'admin' THEN
        RETURN TRUE;
    END IF;

    -- Check follower count for non-admins
    SELECT COUNT(*)
    INTO v_followers_count
    FROM public.user_follows
    WHERE following_id = p_user_id;

    -- Changed from 100 to 1 follower
    RETURN v_followers_count >= 1;
END;
$$;

-- Fix 2: Update accept_battle to set is_battle = true on both streams
CREATE OR REPLACE FUNCTION public.accept_battle(p_battle_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_battle RECORD;
    v_challenger_stream RECORD;
    v_opponent_stream RECORD;
BEGIN
    -- 1. Lock the battle row
    SELECT * INTO v_battle
    FROM public.battles
    WHERE id = p_battle_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Battle not found: %', p_battle_id;
    END IF;

    -- 2. Ensure the battle is still 'pending'
    IF v_battle.status != 'pending' THEN
        RAISE EXCEPTION 'Battle is not pending (status: %)', v_battle.status;
    END IF;

    -- 3. Lock the streams
    SELECT * INTO v_challenger_stream FROM public.streams WHERE id = v_battle.challenger_stream_id FOR UPDATE;
    SELECT * INTO v_opponent_stream FROM public.streams WHERE id = v_battle.opponent_stream_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'One or both streams not found';
    END IF;

    -- 4. Transition battle to 'active'
    UPDATE public.battles
    SET 
        status = 'active',
        started_at = now()
    WHERE id = p_battle_id;

    -- 5. Set battle_id AND is_battle on both streams (FIXED)
    UPDATE public.streams SET battle_id = p_battle_id, is_battle = true WHERE id = v_battle.challenger_stream_id;
    UPDATE public.streams SET battle_id = p_battle_id, is_battle = true WHERE id = v_battle.opponent_stream_id;

    -- Rest of the function continues unchanged...
    -- 6. Snapshot Battle Hosts
    INSERT INTO public.battle_participants (battle_id, user_id, team, role, source_stream_id)
    VALUES 
        (p_battle_id, v_challenger_stream.user_id, 'challenger', 'host', v_battle.challenger_stream_id),
        (p_battle_id, v_opponent_stream.user_id, 'opponent', 'host', v_battle.opponent_stream_id)
    ON CONFLICT (battle_id, user_id) DO NOTHING;

    RETURN TRUE;
END;
$$;

-- Fix 3: Update find_match_candidate to remove camera_ready requirement for Trollmers
-- (This is already fixed in the source files, the migration will handle it)
