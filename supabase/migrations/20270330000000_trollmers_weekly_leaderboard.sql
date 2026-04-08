-- Trollmers weekly leaderboard + payout from public pool (admin_pool)

-- 1. Stream and battle type flags
ALTER TABLE public.streams
ADD COLUMN IF NOT EXISTS stream_kind TEXT DEFAULT 'regular'
CHECK (stream_kind IN ('regular', 'trollmers'));

ALTER TABLE public.streams
ADD COLUMN IF NOT EXISTS camera_ready BOOLEAN DEFAULT false;

ALTER TABLE public.battles
ADD COLUMN IF NOT EXISTS battle_type TEXT DEFAULT 'standard'
CHECK (battle_type IN ('standard', 'trollmers'));

-- 1b. Monthly tournament tables
CREATE TABLE IF NOT EXISTS public.trollmers_monthly_tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month_start DATE NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
    qualifier_cutoff INTEGER NOT NULL DEFAULT 16,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    winner_user_id UUID REFERENCES public.user_profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.trollmers_monthly_tournaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read trollmers tournaments"
ON public.trollmers_monthly_tournaments
FOR SELECT
USING (true);
CREATE TABLE IF NOT EXISTS public.trollmers_tournament_participants (
    tournament_id UUID NOT NULL REFERENCES public.trollmers_monthly_tournaments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    seed INTEGER,
    status TEXT NOT NULL DEFAULT 'qualified' CHECK (status IN ('qualified', 'active', 'eliminated', 'winner')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tournament_id, user_id)
);

ALTER TABLE public.trollmers_tournament_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read trollmers tournament participants"
ON public.trollmers_tournament_participants
FOR SELECT
USING (true);

CREATE TABLE IF NOT EXISTS public.trollmers_tournament_battles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES public.trollmers_monthly_tournaments(id) ON DELETE CASCADE,
    battle_id UUID REFERENCES public.battles(id) ON DELETE SET NULL,
    round INTEGER NOT NULL CHECK (round > 0),
    bracket_position INTEGER NOT NULL,
    participant1_id UUID REFERENCES public.user_profiles(id),
    participant2_id UUID REFERENCES public.user_profiles(id),
    winner_id UUID REFERENCES public.user_profiles(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.trollmers_tournament_battles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read trollmers tournament battles"
ON public.trollmers_tournament_battles
FOR SELECT
USING (true);

-- 2. Weekly leaderboard table
CREATE TABLE IF NOT EXISTS public.trollmers_weekly_leaderboard (
    week_start DATE NOT NULL,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    battles_played INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,
    coins_earned BIGINT NOT NULL DEFAULT 0,
    score BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (week_start, user_id)
);

CREATE INDEX IF NOT EXISTS idx_trollmers_weekly_leaderboard_week_score
ON public.trollmers_weekly_leaderboard (week_start, score DESC);

ALTER TABLE public.trollmers_weekly_leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read trollmers weekly leaderboard"
ON public.trollmers_weekly_leaderboard
FOR SELECT
USING (true);

-- 3. Weekly payout tracking
CREATE TABLE IF NOT EXISTS public.trollmers_weekly_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_start DATE NOT NULL,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 3),
    payout_coins BIGINT NOT NULL CHECK (payout_coins >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (week_start, rank)
);

CREATE INDEX IF NOT EXISTS idx_trollmers_weekly_payouts_week
ON public.trollmers_weekly_payouts (week_start);

ALTER TABLE public.trollmers_weekly_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read trollmers weekly payouts"
ON public.trollmers_weekly_payouts
FOR SELECT
USING (true);

-- 4. Helper: get week start in America/Denver
CREATE OR REPLACE FUNCTION public.get_trollmers_week_start(
    p_ts TIMESTAMPTZ DEFAULT NOW()
)
RETURNS DATE
LANGUAGE SQL
STABLE
AS $$
    SELECT (date_trunc('week', p_ts AT TIME ZONE 'America/Denver'))::DATE;
$$;

-- 5. Update weekly leaderboard for a battle (trollmers only)
CREATE OR REPLACE FUNCTION public.update_trollmers_weekly_leaderboard(
    p_battle_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_battle RECORD;
    v_week_start DATE;
    v_challenger_host UUID;
    v_opponent_host UUID;
    v_challenger_score BIGINT;
    v_opponent_score BIGINT;
    v_challenger_win BOOLEAN := FALSE;
    v_opponent_win BOOLEAN := FALSE;
    v_is_draw BOOLEAN := FALSE;
    v_challenger_kind TEXT;
    v_opponent_kind TEXT;
BEGIN
    SELECT * INTO v_battle FROM public.battles WHERE id = p_battle_id;

    IF v_battle IS NULL THEN
        RETURN;
    END IF;

    IF v_battle.status <> 'ended' THEN
        RETURN;
    END IF;

    -- Determine if this is a Trollmers battle
    IF v_battle.battle_type IS NOT NULL AND v_battle.battle_type <> 'trollmers' THEN
        RETURN;
    END IF;
    SELECT user_id, stream_kind INTO v_challenger_host, v_challenger_kind
    FROM public.streams WHERE id = v_battle.challenger_stream_id;

    SELECT user_id, stream_kind INTO v_opponent_host, v_opponent_kind
    FROM public.streams WHERE id = v_battle.opponent_stream_id;

    IF v_challenger_host IS NULL OR v_opponent_host IS NULL THEN
        RETURN;
    END IF;

    IF v_battle.battle_type IS NULL THEN
        IF COALESCE(v_challenger_kind, 'regular') <> 'trollmers'
           OR COALESCE(v_opponent_kind, 'regular') <> 'trollmers' THEN
            RETURN;
        END IF;
    END IF;

    v_week_start := public.get_trollmers_week_start(COALESCE(v_battle.ended_at, NOW()));

    v_challenger_score := COALESCE(v_battle.pot_challenger, v_battle.score_challenger, 0)::BIGINT;
    v_opponent_score := COALESCE(v_battle.pot_opponent, v_battle.score_opponent, 0)::BIGINT;

    IF v_challenger_score > v_opponent_score THEN
        v_challenger_win := TRUE;
    ELSIF v_opponent_score > v_challenger_score THEN
        v_opponent_win := TRUE;
    ELSE
        v_is_draw := TRUE;
    END IF;

    INSERT INTO public.trollmers_weekly_leaderboard (
        week_start,
        user_id,
        battles_played,
        wins,
        losses,
        draws,
        coins_earned,
        score,
        updated_at
    ) VALUES (
        v_week_start,
        v_challenger_host,
        1,
        CASE WHEN v_challenger_win THEN 1 ELSE 0 END,
        CASE WHEN v_opponent_win THEN 1 ELSE 0 END,
        CASE WHEN v_is_draw THEN 1 ELSE 0 END,
        v_challenger_score,
        v_challenger_score,
        NOW()
    ) ON CONFLICT (week_start, user_id)
    DO UPDATE SET
        battles_played = public.trollmers_weekly_leaderboard.battles_played + 1,
        wins = public.trollmers_weekly_leaderboard.wins + CASE WHEN v_challenger_win THEN 1 ELSE 0 END,
        losses = public.trollmers_weekly_leaderboard.losses + CASE WHEN v_opponent_win THEN 1 ELSE 0 END,
        draws = public.trollmers_weekly_leaderboard.draws + CASE WHEN v_is_draw THEN 1 ELSE 0 END,
        coins_earned = public.trollmers_weekly_leaderboard.coins_earned + v_challenger_score,
        score = public.trollmers_weekly_leaderboard.score + v_challenger_score,
        updated_at = NOW();

    INSERT INTO public.trollmers_weekly_leaderboard (
        week_start,
        user_id,
        battles_played,
        wins,
        losses,
        draws,
        coins_earned,
        score,
        updated_at
    ) VALUES (
        v_week_start,
        v_opponent_host,
        1,
        CASE WHEN v_opponent_win THEN 1 ELSE 0 END,
        CASE WHEN v_challenger_win THEN 1 ELSE 0 END,
        CASE WHEN v_is_draw THEN 1 ELSE 0 END,
        v_opponent_score,
        v_opponent_score,
        NOW()
    ) ON CONFLICT (week_start, user_id)
    DO UPDATE SET
        battles_played = public.trollmers_weekly_leaderboard.battles_played + 1,
        wins = public.trollmers_weekly_leaderboard.wins + CASE WHEN v_opponent_win THEN 1 ELSE 0 END,
        losses = public.trollmers_weekly_leaderboard.losses + CASE WHEN v_challenger_win THEN 1 ELSE 0 END,
        draws = public.trollmers_weekly_leaderboard.draws + CASE WHEN v_is_draw THEN 1 ELSE 0 END,
        coins_earned = public.trollmers_weekly_leaderboard.coins_earned + v_opponent_score,
        score = public.trollmers_weekly_leaderboard.score + v_opponent_score,
        updated_at = NOW();
END;
$$;

-- 6. Payout top 3 for a given week (from admin_pool)
CREATE OR REPLACE FUNCTION public.payout_trollmers_weekly(
    p_week_start DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_weekly_total BIGINT := 2000;
    v_week_start DATE;
    v_pool_id UUID;
    v_pool_balance BIGINT;
    v_first BIGINT;
    v_second BIGINT;
    v_third BIGINT;
    v_paid_total BIGINT := 0;
    v_rows RECORD;
    v_rank INTEGER := 0;
BEGIN
    v_week_start := COALESCE(p_week_start, public.get_trollmers_week_start(NOW() - INTERVAL '7 days'));

    -- Prevent double payouts
    IF EXISTS (
        SELECT 1 FROM public.trollmers_weekly_payouts
        WHERE week_start = v_week_start
    ) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Weekly payout already processed');
    END IF;

    -- Lock admin pool
    SELECT id, COALESCE(trollcoins_balance, 0)::BIGINT
    INTO v_pool_id, v_pool_balance
    FROM public.admin_pool
    LIMIT 1
    FOR UPDATE;

    IF v_pool_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Admin pool not configured');
    END IF;

    IF v_pool_balance < v_weekly_total THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient pool funds for weekly payout');
    END IF;

    v_first := FLOOR(v_weekly_total * 0.50);
    v_second := FLOOR(v_weekly_total * 0.30);
    v_third := v_weekly_total - v_first - v_second;

    FOR v_rows IN
        SELECT user_id, score
        FROM public.trollmers_weekly_leaderboard
        WHERE week_start = v_week_start
        ORDER BY score DESC, coins_earned DESC, wins DESC
        LIMIT 3
    LOOP
        v_rank := v_rank + 1;

        v_paid_total := v_paid_total + CASE
            WHEN v_rank = 1 THEN v_first
            WHEN v_rank = 2 THEN v_second
            ELSE v_third
        END;

        INSERT INTO public.trollmers_weekly_payouts (week_start, user_id, rank, payout_coins)
        VALUES (
            v_week_start,
            v_rows.user_id,
            v_rank,
            CASE
                WHEN v_rank = 1 THEN v_first
                WHEN v_rank = 2 THEN v_second
                ELSE v_third
            END
        );

        UPDATE public.user_profiles
        SET troll_coins = COALESCE(troll_coins, 0) +
            CASE
                WHEN v_rank = 1 THEN v_first
                WHEN v_rank = 2 THEN v_second
                ELSE v_third
            END
        WHERE id = v_rows.user_id;
        INSERT INTO public.coin_ledger (user_id, amount, transaction_type, reason, metadata)
        VALUES (
            v_rows.user_id,
            CASE
                WHEN v_rank = 1 THEN v_first
                WHEN v_rank = 2 THEN v_second
                ELSE v_third
            END,
            'income',
            'trollmers_weekly_payout',
            jsonb_build_object('week_start', v_week_start, 'rank', v_rank)
        );

        INSERT INTO public.admin_pool_ledger (amount, reason, ref_user_id, created_at)
        VALUES (
            -1 * CASE
                WHEN v_rank = 1 THEN v_first
                WHEN v_rank = 2 THEN v_second
                ELSE v_third
            END,
            'trollmers_weekly_payout_rank_' || v_rank,
            v_rows.user_id,
            NOW()
        );
    END LOOP;

    IF v_rank = 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'No leaderboard entries for the week');
    END IF;

    -- Deduct from admin pool
    UPDATE public.admin_pool
    SET trollcoins_balance = COALESCE(trollcoins_balance, 0) - v_paid_total,
        updated_at = NOW()
    WHERE id = v_pool_id;

    RETURN jsonb_build_object(
        'success', true,
        'week_start', v_week_start,
        'total_payout', v_paid_total,
        'rank1', v_first,
        'rank2', v_second,
        'rank3', v_third
    );
END;
$$;

-- 6b. Schedule weekly payout (Mondays 00:05 America/Denver => 07:05 UTC)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'trollmers_weekly_payout'
    ) THEN
        PERFORM cron.schedule(
            'trollmers_weekly_payout',
            '5 7 * * 1',
            'SELECT public.payout_trollmers_weekly()'
        );
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        -- cron extension may not be installed in some environments
        NULL;
END $$;

-- 7. Ensure battles created from trollmers streams are tagged
CREATE OR REPLACE FUNCTION public.create_battle_challenge(
  p_challenger_id UUID,
  p_opponent_id UUID
) RETURNS UUID AS $$
DECLARE
  v_battle_id UUID;
  v_challenger_kind TEXT;
  v_opponent_kind TEXT;
  v_battle_type TEXT := 'standard';
  v_challenger_user_id UUID;
  v_opponent_user_id UUID;
  v_challenger_stream RECORD;
  v_opponent_stream RECORD;
  v_tournament_battle_id UUID;
BEGIN
  -- Validate both streams exist and are live BEFORE creating battle
  SELECT * INTO v_challenger_stream
  FROM public.streams
  WHERE id = p_challenger_id
    AND status = 'live'
    AND is_live = TRUE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Challenger stream not found or not live: %', p_challenger_id;
  END IF;
  
  SELECT * INTO v_opponent_stream
  FROM public.streams
  WHERE id = p_opponent_id
    AND status = 'live'
    AND is_live = TRUE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Opponent stream not found or not live: %', p_opponent_id;
  END IF;

  -- Get stream kinds and user IDs from validated streams
  v_challenger_kind := v_challenger_stream.stream_kind;
  v_challenger_user_id := v_challenger_stream.user_id;
  v_opponent_kind := v_opponent_stream.stream_kind;
  v_opponent_user_id := v_opponent_stream.user_id;

  IF COALESCE(v_challenger_kind, 'regular') = 'trollmers'
     AND COALESCE(v_opponent_kind, 'regular') = 'trollmers' THEN
    v_battle_type := 'trollmers';
  END IF;

  INSERT INTO public.battles (challenger_stream_id, opponent_stream_id, battle_type)
  VALUES (p_challenger_id, p_opponent_id, v_battle_type)
  RETURNING id INTO v_battle_id;

  -- Auto-link to tournament if both participants are in pending tournament match
  IF v_battle_type = 'trollmers' THEN
    SELECT tb.id INTO v_tournament_battle_id
    FROM public.trollmers_tournament_battles tb
    JOIN public.trollmers_monthly_tournaments t ON t.id = tb.tournament_id
    WHERE t.status = 'active'
      AND tb.status = 'pending'
      AND (
        (tb.participant1_id = v_challenger_user_id AND tb.participant2_id = v_opponent_user_id)
        OR
        (tb.participant1_id = v_opponent_user_id AND tb.participant2_id = v_challenger_user_id)
      )
    LIMIT 1;

    IF v_tournament_battle_id IS NOT NULL THEN
      UPDATE public.trollmers_tournament_battles
      SET battle_id = v_battle_id,
          status = 'active'
      WHERE id = v_tournament_battle_id;
    END IF;
  END IF;

  RETURN v_battle_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7b. Helper: check if user meets Trollmers eligibility (100+ followers, camera ready)
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

    RETURN v_followers_count >= 100;
END;
$$;

-- 7c. Prevent seat joins/invites for Trollmers streams (guests not allowed)
CREATE OR REPLACE FUNCTION public.join_seat_atomic(
    p_stream_id UUID,
    p_seat_index INTEGER,
    p_price INTEGER,
    p_user_id UUID DEFAULT NULL,
    p_guest_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session_id UUID;
    v_user_balance BIGINT;
    v_effective_price INTEGER := COALESCE(p_price, 0);
    v_has_paid BOOLEAN := FALSE;
    v_stream_kind TEXT;
BEGIN
    -- Validate inputs
    IF p_user_id IS NULL AND p_guest_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'User ID or Guest ID required');
    END IF;

    -- Check stream kind
    SELECT stream_kind INTO v_stream_kind FROM public.streams WHERE id = p_stream_id;

    IF v_stream_kind = 'trollmers' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Guests are not allowed on Trollmers streams');
    END IF;

    -- Check if seat is occupied
    IF EXISTS (
        SELECT 1 FROM public.stream_seat_sessions 
        WHERE stream_id = p_stream_id 
        AND seat_index = p_seat_index 
        AND status = 'active'
    ) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Seat is occupied');
    END IF;

    -- If user/guest already paid in this stream, skip charging again
    IF p_user_id IS NOT NULL AND v_effective_price > 0 THEN
        SELECT EXISTS (
            SELECT 1 FROM public.stream_seat_sessions
            WHERE stream_id = p_stream_id
              AND user_id = p_user_id
              AND COALESCE(price_paid, 0) > 0
        ) INTO v_has_paid;
    ELSIF p_guest_id IS NOT NULL AND v_effective_price > 0 THEN
        SELECT EXISTS (
            SELECT 1 FROM public.stream_seat_sessions
            WHERE stream_id = p_stream_id
              AND guest_id = p_guest_id
              AND COALESCE(price_paid, 0) > 0
        ) INTO v_has_paid;
    END IF;

    IF v_has_paid THEN
        v_effective_price := 0;
    END IF;

    -- If Registered User -> Check Balance for Price
    IF p_user_id IS NOT NULL AND v_effective_price > 0 THEN
        SELECT troll_coins INTO v_user_balance FROM public.user_profiles WHERE id = p_user_id;
        IF COALESCE(v_user_balance, 0) < v_effective_price THEN
            RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
        END IF;
        
        -- Deduct coins (Simplified: No cuts for MVP/Guest logic adjustment)
        -- In real implementation, call spend_coins or similar
        UPDATE public.user_profiles 
        SET troll_coins = troll_coins - v_effective_price 
        WHERE id = p_user_id;
    END IF;

    -- Insert Session
    INSERT INTO public.stream_seat_sessions (stream_id, seat_index, user_id, guest_id, price_paid, status, joined_at)
    VALUES (p_stream_id, p_seat_index, p_user_id, p_guest_id, v_effective_price, 'active', NOW())
    RETURNING id INTO v_session_id;

    RETURN jsonb_build_object('success', true, 'session_id', v_session_id);
END;
$$;

-- 7d. Update matchmaking to filter for Trollmers eligibility
CREATE OR REPLACE FUNCTION find_match_candidate(
    p_stream_id UUID
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    title TEXT,
    viewer_count INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_recent_opponent_ids UUID[];
    v_busy_stream_ids UUID[];
    v_my_kind TEXT;
    v_my_user_id UUID;
BEGIN
    -- Get kind and user_id of requester
    SELECT stream_kind, s.user_id INTO v_my_kind, v_my_user_id
    FROM streams s WHERE s.id = p_stream_id;

    -- 1. Get IDs of recent opponents (last 10 battles involving p_stream_id)
    SELECT ARRAY_AGG(
        CASE 
            WHEN challenger_stream_id = p_stream_id THEN opponent_stream_id
            ELSE challenger_stream_id
        END
    )
    INTO v_recent_opponent_ids
    FROM (
        SELECT challenger_stream_id, opponent_stream_id
        FROM battles
        WHERE (challenger_stream_id = p_stream_id OR opponent_stream_id = p_stream_id)
        AND status IN ('ended', 'active')
        ORDER BY created_at DESC
        LIMIT 10
    ) recent;

    -- 2. Get IDs of streams currently in a pending or active battle (busy)
    SELECT ARRAY_AGG(
        CASE 
            WHEN challenger_stream_id = p_stream_id THEN opponent_stream_id -- Should not happen if we filter p_stream_id
            WHEN opponent_stream_id = p_stream_id THEN challenger_stream_id -- Should not happen
            ELSE 
                CASE 
                    WHEN challenger_stream_id IS NOT NULL THEN challenger_stream_id
                    ELSE opponent_stream_id
                END
        END
    )
    INTO v_busy_stream_ids
    FROM battles
    WHERE status IN ('pending', 'active');

    -- 3. Return a random stream meeting criteria
    -- If Trollmers stream, only match with other Trollmers streams and eligible users
    IF COALESCE(v_my_kind, 'regular') = 'trollmers' THEN
        RETURN QUERY
        SELECT s.id::UUID, s.user_id::UUID, s.title::TEXT, s.viewer_count::INTEGER
        FROM streams s
        WHERE s.is_live = TRUE
          AND s.is_battle = FALSE
          AND COALESCE(s.stream_kind, 'regular') = 'trollmers'
          AND s.id != p_stream_id
          AND (v_recent_opponent_ids IS NULL OR NOT (s.id = ANY(v_recent_opponent_ids)))
          AND (v_busy_stream_ids IS NULL OR NOT (s.id = ANY(v_busy_stream_ids)))
          AND public.is_trollmers_eligible(s.user_id) = true
        ORDER BY RANDOM()
        LIMIT 1;
    ELSE
        -- Standard matching (unchanged)
        RETURN QUERY
        SELECT s.id::UUID, s.user_id::UUID, s.title::TEXT, s.viewer_count::INTEGER
        FROM streams s
        WHERE s.is_live = TRUE
          AND s.is_battle = FALSE
          AND s.id != p_stream_id
          AND (v_recent_opponent_ids IS NULL OR NOT (s.id = ANY(v_recent_opponent_ids)))
          AND (v_busy_stream_ids IS NULL OR NOT (s.id = ANY(v_busy_stream_ids)))
        ORDER BY RANDOM()
        LIMIT 1;
    END IF;
END;
$$;

-- 8. Update distribute_battle_winnings to update weekly leaderboard
CREATE OR REPLACE FUNCTION public.distribute_battle_winnings(
    p_battle_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_battle RECORD;
    v_total_pot numeric;
    v_winner_stream_id uuid;
    v_loser_stream_id uuid;
    v_winner_host_id uuid;
    v_loser_host_id uuid;
    v_winner_participants uuid[];
    v_share_per_person numeric;
    v_admin_cut numeric;
    v_final_pot numeric;
BEGIN
    -- Get Battle Info with row-level lock
    SELECT * INTO v_battle FROM battles WHERE id = p_battle_id FOR UPDATE;

    IF v_battle IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Battle not found');
    END IF;

    IF v_battle.payout_at IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Winnings already distributed');
    END IF;

    IF v_battle.status = 'ended' AND v_battle.winner_stream_id IS NOT NULL THEN
        -- Determine Winner Side
        IF v_battle.score_challenger > v_battle.score_opponent THEN
            v_winner_stream_id := v_battle.challenger_stream_id;
            v_loser_stream_id := v_battle.opponent_stream_id;
            v_total_pot := COALESCE(v_battle.pot_challenger, 0) + COALESCE(v_battle.pot_opponent, 0);
        ELSE
            v_winner_stream_id := v_battle.opponent_stream_id;
            v_loser_stream_id := v_battle.challenger_stream_id;
            v_total_pot := COALESCE(v_battle.pot_challenger, 0) + COALESCE(v_battle.pot_opponent, 0);
        END IF;

        -- Identify Hosts
        SELECT user_id INTO v_winner_host_id FROM streams WHERE id = v_winner_stream_id;
        SELECT user_id INTO v_loser_host_id FROM streams WHERE id = v_loser_stream_id;

        -- Update Host Stats (Wins/Losses)
        IF v_winner_host_id IS NOT NULL THEN
            UPDATE user_profiles SET battle_wins = battle_wins + 1 WHERE id = v_winner_host_id;
        END IF;
        IF v_loser_host_id IS NOT NULL THEN
            UPDATE user_profiles SET battle_losses = battle_losses + 1 WHERE id = v_loser_host_id;
        END IF;

        -- Get Winner Guests (accepted/joined)
        SELECT array_agg(user_id) INTO v_winner_participants
        FROM stream_guests
        WHERE stream_id = v_winner_stream_id AND status = 'accepted';

        -- Combine Winner Participants for Pot
        IF v_winner_participants IS NULL THEN
            v_winner_participants := ARRAY[v_winner_host_id];
        ELSE
            v_winner_participants := array_append(v_winner_participants, v_winner_host_id);
        END IF;

        -- Apply Admin Cut (10%) to the POT
        v_admin_cut := floor(v_total_pot * 0.10);
        v_final_pot := v_total_pot - v_admin_cut;

        -- Split evenly
        v_share_per_person := floor(v_final_pot / array_length(v_winner_participants, 1));

        -- Distribute Pot (using troll_coins)
        IF v_share_per_person > 0 THEN
            UPDATE user_profiles
            SET troll_coins = troll_coins + v_share_per_person
            WHERE id = ANY(v_winner_participants);

            -- Log Ledger
            INSERT INTO coin_ledger (user_id, amount, transaction_type, reason, metadata)
            SELECT
                u_id,
                v_share_per_person,
                'income',
                'battle_win',
                jsonb_build_object('battle_id', p_battle_id, 'role', 'winner')
            FROM unnest(v_winner_participants) AS u_id;
        END IF;

        -- Mark as paid
        UPDATE battles SET payout_at = NOW() WHERE id = p_battle_id;

        -- Update Trollmers weekly leaderboard (if applicable)
        PERFORM public.update_trollmers_weekly_leaderboard(p_battle_id);

        RETURN jsonb_build_object('success', true, 'distributed', v_final_pot, 'recipients', array_length(v_winner_participants, 1));
    END IF;

    RETURN jsonb_build_object('success', false, 'message', 'Battle not ended or no winner');
END;
$function$;

-- ============================================================================
-- MONTHLY TOURNAMENT SYSTEM
-- ============================================================================

-- 9. Get month start (1st day of given month in America/Denver timezone)
CREATE OR REPLACE FUNCTION public.get_trollmers_month_start(p_ts TIMESTAMPTZ DEFAULT NOW())
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    RETURN DATE_TRUNC('month', p_ts AT TIME ZONE 'America/Denver')::DATE;
END;
$$;

-- 10. Qualify top 16 players and start monthly tournament
CREATE OR REPLACE FUNCTION public.start_trollmers_monthly_tournament(p_month_start DATE DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_month_start DATE;
    v_tournament_id UUID;
    v_qualifiers RECORD;
    v_seed INTEGER := 0;
    v_bracket_matches JSONB := '[]'::jsonb;
    v_round1_position INTEGER := 1;
BEGIN
    -- Determine month start
    IF p_month_start IS NULL THEN
        v_month_start := public.get_trollmers_month_start(NOW());
    ELSE
        v_month_start := p_month_start;
    END IF;

    -- Check if tournament already exists
    IF EXISTS (
        SELECT 1 FROM public.trollmers_monthly_tournaments
        WHERE month_start = v_month_start
    ) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Tournament already exists for this month');
    END IF;

    -- Get previous month start to aggregate weekly scores
    DECLARE
        v_prev_month_start DATE := v_month_start - INTERVAL '1 month';
        v_prev_month_end DATE := v_month_start - INTERVAL '1 day';
    BEGIN
        -- Create temporary table for monthly aggregation
        CREATE TEMP TABLE IF NOT EXISTS temp_monthly_scores AS
        SELECT
            user_id,
            SUM(score) AS total_score,
            SUM(wins) AS total_wins,
            SUM(losses) AS total_losses,
            SUM(coins_earned) AS total_coins
        FROM public.trollmers_weekly_leaderboard
        WHERE week_start >= v_prev_month_start
          AND week_start <= v_prev_month_end
        GROUP BY user_id
        ORDER BY total_score DESC, total_wins DESC
        LIMIT 16;

        -- Check if we have at least 4 qualifiers (minimum for tournament)
        IF (SELECT COUNT(*) FROM temp_monthly_scores) < 4 THEN
            DROP TABLE IF EXISTS temp_monthly_scores;
            RETURN jsonb_build_object('success', false, 'message', 'Not enough qualifiers (minimum 4 required)');
        END IF;

        -- Create tournament
        INSERT INTO public.trollmers_monthly_tournaments (month_start, status, started_at)
        VALUES (v_month_start, 'active', NOW())
        RETURNING id INTO v_tournament_id;

        -- Insert qualified participants with seeding
        INSERT INTO public.trollmers_tournament_participants (tournament_id, user_id, seed, status)
        SELECT v_tournament_id, user_id, ROW_NUMBER() OVER (ORDER BY total_score DESC, total_wins DESC), 'active'
        FROM temp_monthly_scores;

        -- Drop temp table
        DROP TABLE IF EXISTS temp_monthly_scores;
    END;

    -- Generate Round 1 bracket (Single Elimination - 16 players = 8 matches)
    -- Seeding: 1v16, 2v15, 3v14, 4v13, 5v12, 6v11, 7v10, 8v9
    FOR v_qualifiers IN
        SELECT
            p1.user_id AS seed_high,
            p2.user_id AS seed_low,
            p1.seed AS seed_high_num,
            p2.seed AS seed_low_num
        FROM public.trollmers_tournament_participants p1
        JOIN public.trollmers_tournament_participants p2
          ON p1.tournament_id = p2.tournament_id
         AND p1.seed + p2.seed = 17  -- Pairs: 1+16, 2+15, etc.
        WHERE p1.tournament_id = v_tournament_id
          AND p1.seed < p2.seed
        ORDER BY p1.seed
    LOOP
        INSERT INTO public.trollmers_tournament_battles (
            tournament_id,
            round,
            bracket_position,
            participant1_id,
            participant2_id,
            status
        ) VALUES (
            v_tournament_id,
            1,  -- Round 1 (Round of 16)
            v_round1_position,
            v_qualifiers.seed_high,
            v_qualifiers.seed_low,
            'pending'
        );

        v_round1_position := v_round1_position + 1;
    END LOOP;

    -- Post tournament start announcement to wall
    INSERT INTO public.wall_posts (user_id, content, visibility, created_at)
    VALUES (
        (SELECT id FROM public.user_profiles WHERE role = 'admin' LIMIT 1),
        '🏆 TROLLMERS MONTHLY TOURNAMENT HAS BEGUN! 🏆' || E'\n\n' ||
        '16 elite Trollmers have qualified for the Universe Championship!' || E'\n' ||
        'Head-to-head elimination battles start NOW. May the best Trollmer win!' || E'\n\n' ||
        '#TrollmersUniverse #MonthlyTournament',
        'public',
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'tournament_id', v_tournament_id,
        'month_start', v_month_start,
        'qualifiers', (SELECT COUNT(*) FROM public.trollmers_tournament_participants WHERE tournament_id = v_tournament_id),
        'round1_matches', v_round1_position - 1
    );
END;
$$;

-- 11. Record tournament battle result and auto-advance bracket
CREATE OR REPLACE FUNCTION public.complete_trollmers_tournament_battle(
    p_tournament_battle_id UUID,
    p_winner_user_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tournament_battle RECORD;
    v_loser_user_id UUID;
    v_next_round INTEGER;
    v_next_bracket_position INTEGER;
    v_tournament_id UUID;
    v_is_finals BOOLEAN := false;
BEGIN
    -- Get tournament battle info
    SELECT * INTO v_tournament_battle
    FROM public.trollmers_tournament_battles
    WHERE id = p_tournament_battle_id;

    IF v_tournament_battle IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Tournament battle not found');
    END IF;

    IF v_tournament_battle.status = 'completed' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Battle already completed');
    END IF;

    -- Validate winner is one of the participants
    IF p_winner_user_id NOT IN (v_tournament_battle.participant1_id, v_tournament_battle.participant2_id) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Winner must be one of the participants');
    END IF;

    v_tournament_id := v_tournament_battle.tournament_id;

    -- Determine loser
    IF p_winner_user_id = v_tournament_battle.participant1_id THEN
        v_loser_user_id := v_tournament_battle.participant2_id;
    ELSE
        v_loser_user_id := v_tournament_battle.participant1_id;
    END IF;

    -- Update tournament battle with winner
    UPDATE public.trollmers_tournament_battles
    SET winner_id = p_winner_user_id,
        status = 'completed'
    WHERE id = p_tournament_battle_id;

    -- Mark loser as eliminated
    UPDATE public.trollmers_tournament_participants
    SET status = 'eliminated'
    WHERE tournament_id = v_tournament_id
      AND user_id = v_loser_user_id;

    -- Check if this was the finals (last match of tournament)
    SELECT COUNT(*) = 1 INTO v_is_finals
    FROM public.trollmers_tournament_battles
    WHERE tournament_id = v_tournament_id
      AND status != 'completed';

    IF v_is_finals THEN
        -- Tournament complete - mark winner
        UPDATE public.trollmers_monthly_tournaments
        SET status = 'completed',
            winner_user_id = p_winner_user_id,
            completed_at = NOW()
        WHERE id = v_tournament_id;

        UPDATE public.trollmers_tournament_participants
        SET status = 'winner'
        WHERE tournament_id = v_tournament_id
          AND user_id = p_winner_user_id;

        -- Post winner announcement
        INSERT INTO public.wall_posts (user_id, content, visibility, created_at)
        SELECT
            p_winner_user_id,
            '🏆👑 TROLLMERS UNIVERSE CHAMPION! 👑🏆' || E'\n\n' ||
            up.username || ' has conquered the monthly tournament and is crowned Universe Champion!' || E'\n' ||
            'All hail the supreme Trollmer!' || E'\n\n' ||
            '#UniverseChampion #TrollmersUniverse',
            'public',
            NOW()
        FROM public.user_profiles up
        WHERE up.id = p_winner_user_id;

        RETURN jsonb_build_object(
            'success', true,
            'tournament_complete', true,
            'winner_id', p_winner_user_id,
            'message', 'Tournament complete!'
        );
    END IF;

    -- Advance to next round
    v_next_round := v_tournament_battle.round + 1;
    v_next_bracket_position := CEIL(v_tournament_battle.bracket_position::NUMERIC / 2);

    -- Check if next round match already exists
    IF EXISTS (
        SELECT 1 FROM public.trollmers_tournament_battles
        WHERE tournament_id = v_tournament_id
          AND round = v_next_round
          AND bracket_position = v_next_bracket_position
    ) THEN
        -- Update existing match with this winner
        UPDATE public.trollmers_tournament_battles
        SET participant2_id = p_winner_user_id,
            status = CASE
                WHEN participant1_id IS NOT NULL THEN 'pending'
                ELSE status
            END
        WHERE tournament_id = v_tournament_id
          AND round = v_next_round
          AND bracket_position = v_next_bracket_position
          AND participant1_id IS NOT NULL;

        -- If both slots empty, set as participant1
        UPDATE public.trollmers_tournament_battles
        SET participant1_id = p_winner_user_id
        WHERE tournament_id = v_tournament_id
          AND round = v_next_round
          AND bracket_position = v_next_bracket_position
          AND participant1_id IS NULL;
    ELSE
        -- Create next round match
        INSERT INTO public.trollmers_tournament_battles (
            tournament_id,
            round,
            bracket_position,
            participant1_id,
            status
        ) VALUES (
            v_tournament_id,
            v_next_round,
            v_next_bracket_position,
            p_winner_user_id,
            'pending'
        );
    END IF;

    -- Check if next match is ready to start
    DECLARE
        v_next_match RECORD;
    BEGIN
        SELECT * INTO v_next_match
        FROM public.trollmers_tournament_battles
        WHERE tournament_id = v_tournament_id
          AND round = v_next_round
          AND bracket_position = v_next_bracket_position;

        IF v_next_match.participant1_id IS NOT NULL AND v_next_match.participant2_id IS NOT NULL THEN
            -- Post bracket advancement announcement
            INSERT INTO public.wall_posts (user_id, content, visibility, created_at)
            SELECT
                (SELECT id FROM public.user_profiles WHERE role = 'admin' LIMIT 1),
                '⚔️ TROLLMERS TOURNAMENT BRACKET UPDATE ⚔️' || E'\n\n' ||
                'Round ' || v_next_round || ' Match Ready!' || E'\n' ||
                p1.username || ' vs ' || p2.username || E'\n' ||
                'Battle for supremacy begins now!' || E'\n\n' ||
                '#TrollmersTournament',
                'public',
                NOW()
            FROM public.user_profiles p1, public.user_profiles p2
            WHERE p1.id = v_next_match.participant1_id
              AND p2.id = v_next_match.participant2_id;
        END IF;
    END;

    RETURN jsonb_build_object(
        'success', true,
        'tournament_complete', false,
        'advanced_to_round', v_next_round,
        'winner_id', p_winner_user_id
    );
END;
$$;

-- 12. Link battle result to tournament system (called after battle ends)
CREATE OR REPLACE FUNCTION public.process_tournament_battle_result()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tournament_battle_id UUID;
    v_winner_user_id UUID;
    v_challenger_user_id UUID;
    v_opponent_user_id UUID;
    v_has_winner_stream_id BOOLEAN;
BEGIN
    -- Check if winner_stream_id column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'battles' AND column_name = 'winner_stream_id'
    ) INTO v_has_winner_stream_id;

    -- Only process if battle is Trollmers type and ended with winner
    -- Use column existence check to avoid errors
    IF NEW.battle_type = 'trollmers' AND NEW.status = 'ended' THEN
        -- Check winner based on available columns
        IF v_has_winner_stream_id AND NEW.winner_stream_id IS NOT NULL THEN
            -- Check if this battle is linked to a tournament
            SELECT tb.id INTO v_tournament_battle_id
            FROM public.trollmers_tournament_battles tb
            WHERE tb.battle_id = NEW.id;

            IF v_tournament_battle_id IS NOT NULL THEN
                -- Get user IDs from streams
                SELECT s.user_id INTO v_challenger_user_id
                FROM public.streams s
                WHERE s.id = NEW.challenger_stream_id;

                SELECT s.user_id INTO v_opponent_user_id
                FROM public.streams s
                WHERE s.id = NEW.opponent_stream_id;

                -- Determine winner user ID based on winner stream
                IF NEW.winner_stream_id = NEW.challenger_stream_id THEN
                    v_winner_user_id := v_challenger_user_id;
                ELSE
                    v_winner_user_id := v_opponent_user_id;
                END IF;

                -- Complete tournament battle and advance bracket
                PERFORM public.complete_trollmers_tournament_battle(v_tournament_battle_id, v_winner_user_id);
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Create trigger to auto-process tournament battles (only if winner_stream_id column exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'battles' AND column_name = 'winner_stream_id') THEN
        DROP TRIGGER IF EXISTS trigger_process_tournament_battle ON public.battles;
        CREATE TRIGGER trigger_process_tournament_battle
        AFTER UPDATE OF status, winner_stream_id ON public.battles
        FOR EACH ROW
        WHEN (NEW.status = 'ended' AND NEW.winner_stream_id IS NOT NULL)
        EXECUTE FUNCTION public.process_tournament_battle_result();
    END IF;
END $$;

-- 13. Schedule monthly tournament start (1st of each month at 00:05 America/Denver => 07:05 UTC)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'trollmers_monthly_tournament_start'
    ) THEN
        PERFORM cron.schedule(
            'trollmers_monthly_tournament_start',
            '5 7 1 * *',  -- Every 1st day of month at 07:05 UTC
            'SELECT public.start_trollmers_monthly_tournament()'
        );
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        -- cron extension may not be installed
        RAISE NOTICE 'pg_cron not available, monthly tournament must be started manually';
END;
$$;

-- 14. Create tournament battle when two tournament participants face off
CREATE OR REPLACE FUNCTION public.link_battle_to_tournament(
    p_battle_id UUID,
    p_tournament_battle_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Link the actual battle to the tournament bracket position
    UPDATE public.trollmers_tournament_battles
    SET battle_id = p_battle_id,
        status = 'active'
    WHERE id = p_tournament_battle_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Tournament battle not found');
    END IF;

    RETURN jsonb_build_object('success', true, 'battle_id', p_battle_id);
END;
$$;

-- 15. Get active tournament info and bracket
CREATE OR REPLACE FUNCTION public.get_active_trollmers_tournament()
RETURNS TABLE (
    tournament_id UUID,
    month_start DATE,
    status TEXT,
    started_at TIMESTAMPTZ,
    winner_user_id UUID,
    participant_count BIGINT,
    current_round INTEGER
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.month_start,
        t.status,
        t.started_at,
        t.winner_user_id,
        (SELECT COUNT(*) FROM public.trollmers_tournament_participants WHERE tournament_id = t.id),
        COALESCE((SELECT MAX(round) FROM public.trollmers_tournament_battles WHERE tournament_id = t.id AND status = 'active'), 1)
    FROM public.trollmers_monthly_tournaments t
    WHERE t.status IN ('pending', 'active')
    ORDER BY t.month_start DESC
    LIMIT 1;
END;
$$;

-- 16. Admin function to manually cancel tournament
CREATE OR REPLACE FUNCTION public.cancel_trollmers_tournament(p_tournament_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.trollmers_monthly_tournaments
    SET status = 'cancelled'
    WHERE id = p_tournament_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Tournament not found');
    END IF;

    RETURN jsonb_build_object('success', true, 'tournament_id', p_tournament_id);
END;
$$;
