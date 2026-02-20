
CREATE OR REPLACE FUNCTION public.end_stale_battles() RETURNS VOID AS $$
DECLARE
  stale_battle_id UUID;
  host_stream_live BOOLEAN;
  opponent_stream_live BOOLEAN;
  battle_record RECORD;
BEGIN
  FOR battle_record IN
    SELECT b.id, b.started_at, b.stream_id as battle_stream_id, s_host.is_live as host_is_live
    FROM public.battles b
    LEFT JOIN public.streams s_host ON b.stream_id = s_host.id
    WHERE b.status = 'active'
  LOOP
    -- Check if the battle's primary stream (host's stream) is no longer live
    -- or if the battle has been active for more than 24 hours.
    -- The opponent_id is optional, so we focus on the primary stream linked to the battle.
    IF (battle_record.host_is_live IS FALSE OR battle_record.host_is_live IS NULL) OR
       (battle_record.started_at IS NOT NULL AND battle_record.started_at < NOW() - INTERVAL '24 hours') THEN
      
      -- End the battle using the existing public.end_battle RPC
      -- We pass NULL for p_winner_stream_id as this is an automated cleanup
      PERFORM public.end_battle(battle_record.id, NULL);
      RAISE NOTICE 'Ended stale battle: %', battle_record.id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.end_stale_battles() OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.end_stale_battles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_stale_battles() TO service_role;
