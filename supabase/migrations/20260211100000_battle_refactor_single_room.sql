-- Merge two live streams into one shared Battle Room
-- This migration creates the battle_participants table and updates the accept_battle RPC

-- 1. Create battle_participants table
CREATE TABLE IF NOT EXISTS public.battle_participants (
    battle_id UUID NOT NULL REFERENCES public.battles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    team TEXT NOT NULL CHECK (team IN ('challenger', 'opponent')),
    role TEXT NOT NULL CHECK (role IN ('host', 'stage', 'viewer')),
    source_stream_id UUID NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
    seat_index INTEGER,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (battle_id, user_id)
);

-- Enable RLS
ALTER TABLE public.battle_participants ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public read battle participants" ON public.battle_participants
    FOR SELECT USING (true);

CREATE POLICY "Users can insert themselves into battle participants" ON public.battle_participants
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 2. Update accept_battle RPC to be atomic and snapshot stage guests
CREATE OR REPLACE FUNCTION public.accept_battle(
    p_battle_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_battle RECORD;
    v_challenger_host_id UUID;
    v_opponent_host_id UUID;
BEGIN
    -- 1. Fetch battle and lock it
    SELECT * INTO v_battle FROM public.battles WHERE id = p_battle_id FOR UPDATE;
    
    IF v_battle IS NULL THEN
        RAISE EXCEPTION 'Battle not found';
    END IF;

    IF v_battle.status <> 'pending' THEN
        RETURN FALSE; -- Already accepted or ended
    END IF;

    -- 2. Update battle status
    UPDATE public.battles 
    SET status = 'active', started_at = now() 
    WHERE id = p_battle_id;

    -- 3. Link both streams to this battle
    UPDATE public.streams 
    SET battle_id = p_battle_id, is_battle = true
    WHERE id IN (v_battle.challenger_stream_id, v_battle.opponent_stream_id);

    -- 4. Get Host IDs
    SELECT user_id INTO v_challenger_host_id FROM public.streams WHERE id = v_battle.challenger_stream_id;
    SELECT user_id INTO v_opponent_host_id FROM public.streams WHERE id = v_battle.opponent_stream_id;

    -- 5. Snapshot Participants (Hosts)
    INSERT INTO public.battle_participants (battle_id, user_id, team, role, source_stream_id, seat_index)
    VALUES 
        (p_battle_id, v_challenger_host_id, 'challenger', 'host', v_battle.challenger_stream_id, 0),
        (p_battle_id, v_opponent_host_id, 'opponent', 'host', v_battle.opponent_stream_id, 0)
    ON CONFLICT (battle_id, user_id) DO NOTHING;

    -- 6. Snapshot Stage Guests (Challenger)
    INSERT INTO public.battle_participants (battle_id, user_id, team, role, source_stream_id, seat_index)
    SELECT 
        p_battle_id,
        user_id,
        'challenger',
        'stage',
        v_battle.challenger_stream_id,
        seat_index
    FROM public.stream_seat_sessions
    WHERE stream_id = v_battle.challenger_stream_id AND status = 'active' AND user_id IS NOT NULL
    ON CONFLICT (battle_id, user_id) DO NOTHING;

    -- 7. Snapshot Stage Guests (Opponent)
    INSERT INTO public.battle_participants (battle_id, user_id, team, role, source_stream_id, seat_index)
    SELECT 
        p_battle_id,
        user_id,
        'opponent',
        'stage',
        v_battle.opponent_stream_id,
        seat_index
    FROM public.stream_seat_sessions
    WHERE stream_id = v_battle.opponent_stream_id AND status = 'active' AND user_id IS NOT NULL
    ON CONFLICT (battle_id, user_id) DO NOTHING;

    -- 8. Notify clients of the change via streams update (already handled by streams UPDATE)
    -- But we can add explicit notifies if needed. For now, we rely on streams.battle_id change.

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
