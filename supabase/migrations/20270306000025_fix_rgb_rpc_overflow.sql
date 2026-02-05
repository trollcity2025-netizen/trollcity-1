-- Fix integer overflow in purchase_rgb_broadcast by using BIGINT for balance check

CREATE OR REPLACE FUNCTION purchase_rgb_broadcast(p_stream_id UUID, p_enable BOOLEAN)
RETURNS TABLE (success BOOLEAN, message TEXT, error TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stream record;
  v_user_id uuid;
  v_balance bigint; -- Changed from int to bigint to prevent overflow
  v_cost int := 10;
BEGIN
  -- Get stream info
  SELECT * INTO v_stream FROM public.streams WHERE id = p_stream_id;
  
  IF v_stream IS NULL THEN
    RETURN QUERY SELECT false, NULL::TEXT, 'Stream not found'::TEXT;
    RETURN;
  END IF;

  v_user_id := auth.uid();
  
  -- Check ownership (or admin)
  IF v_stream.user_id != v_user_id AND NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = v_user_id AND (role = 'admin' OR is_admin = true)) THEN
    RETURN QUERY SELECT false, NULL::TEXT, 'Not authorized'::TEXT;
    RETURN;
  END IF;

  -- If enabling
  IF p_enable THEN
    -- Check if already purchased
    IF v_stream.rgb_purchased THEN
      -- Just enable
      UPDATE public.streams SET has_rgb_effect = true WHERE id = p_stream_id;
      RETURN QUERY SELECT true, 'Enabled'::TEXT, NULL::TEXT;
    ELSE
      -- Need to purchase
      -- Check balance
      SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = v_user_id;
      
      IF v_balance < v_cost THEN
        RETURN QUERY SELECT false, NULL::TEXT, 'Insufficient coins (Cost: 10)'::TEXT;
        RETURN;
      END IF;
      
      -- Deduct coins
      UPDATE public.user_profiles 
      SET troll_coins = troll_coins - v_cost 
      WHERE id = v_user_id;
      
      -- Update stream
      UPDATE public.streams 
      SET has_rgb_effect = true, rgb_purchased = true 
      WHERE id = p_stream_id;
      
      RETURN QUERY SELECT true, 'Purchased and Enabled'::TEXT, NULL::TEXT;
    END IF;
  ELSE
    -- Disabling
    UPDATE public.streams SET has_rgb_effect = false WHERE id = p_stream_id;
    RETURN QUERY SELECT true, 'Disabled'::TEXT, NULL::TEXT;
  END IF;
END;
$$;
