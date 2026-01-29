-- Migration: Broadcast Level Decay

CREATE OR REPLACE FUNCTION public.decay_broadcast_levels()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Decay logic:
    -- Reduce level by 1% for every stream where:
    -- 1. Stream is active (status = 'live')
    -- 2. No gift received in the last 2 minutes (NOW() - last_gift_time > '2 minutes')
    -- 3. Level > 0
    
    UPDATE public.streams
    SET broadcast_level_percent = GREATEST(0, broadcast_level_percent - 1)
    WHERE status = 'live'
    AND broadcast_level_percent > 0
    AND (last_gift_time IS NULL OR last_gift_time < NOW() - INTERVAL '2 minutes');
END;
$$;
