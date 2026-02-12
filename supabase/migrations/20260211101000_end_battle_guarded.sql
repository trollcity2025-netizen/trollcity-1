-- Guarded battle end to prevent early client-triggered endings

CREATE OR REPLACE FUNCTION public.end_battle_guarded(
  p_battle_id UUID,
  p_winner_id UUID DEFAULT NULL,
  p_min_duration_seconds INTEGER DEFAULT 180,
  p_sudden_death_seconds INTEGER DEFAULT 10
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_battle RECORD;
  v_required INTERVAL;
BEGIN
  SELECT * INTO v_battle FROM public.battles WHERE id = p_battle_id;

  IF v_battle IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Battle not found');
  END IF;

  IF v_battle.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Battle not active');
  END IF;

  IF v_battle.started_at IS NULL OR v_battle.started_at > now() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Battle not started');
  END IF;

  v_required := make_interval(secs => p_min_duration_seconds + p_sudden_death_seconds);

  IF now() < v_battle.started_at + v_required THEN
    RETURN jsonb_build_object('success', false, 'message', 'Battle timer not elapsed');
  END IF;

  UPDATE public.battles
  SET status = 'ended', ended_at = now()
  WHERE id = p_battle_id;

  IF p_winner_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'battles' AND column_name = 'winner_id'
    ) THEN
      EXECUTE 'UPDATE public.battles SET winner_id = $1 WHERE id = $2'
      USING p_winner_id, p_battle_id;
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'battles' AND column_name = 'winner_stream_id'
    ) THEN
      EXECUTE 'UPDATE public.battles SET winner_stream_id = $1 WHERE id = $2'
      USING p_winner_id, p_battle_id;
    END IF;
  END IF;

  UPDATE public.streams
  SET battle_id = NULL
  WHERE battle_id = p_battle_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.end_battle_guarded(UUID, UUID, INTEGER, INTEGER) TO authenticated;
