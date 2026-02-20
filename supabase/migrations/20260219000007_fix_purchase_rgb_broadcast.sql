CREATE OR REPLACE FUNCTION purchase_rgb_broadcast(p_stream_id uuid, p_enable boolean)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_cost BIGINT := 10;
  v_user_balance BIGINT;
  v_already_purchased BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not authenticated');
  END IF;

  -- Check if already purchased for this stream
  SELECT EXISTS (
    SELECT 1 FROM public.coin_transactions
    WHERE user_id = v_user_id
    AND type = 'visual_effect_purchase'
    AND metadata->>'stream_id' = p_stream_id::text
    AND metadata->>'effect' = 'rgb'
  ) INTO v_already_purchased;

  IF p_enable AND NOT v_already_purchased THEN
    -- Check balance
    SELECT troll_coins INTO v_user_balance FROM public.user_profiles WHERE id = v_user_id;

    IF v_user_balance < v_cost THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds');
    END IF;

    -- Deduct cost
    UPDATE public.user_profiles
    SET troll_coins = troll_coins - v_cost
    WHERE id = v_user_id;

    -- Log transaction
    INSERT INTO public.coin_transactions (user_id, amount, type, metadata)
    VALUES (v_user_id, -v_cost, 'visual_effect_purchase', jsonb_build_object('stream_id', p_stream_id, 'effect', 'rgb'));

    -- Update stream
    UPDATE public.streams SET has_rgb_effect = true, rgb_purchased = true WHERE id = p_stream_id;
    
    RETURN jsonb_build_object('success', true, 'message', 'Purchased and Enabled');

  ELSE
    -- Just toggle if already purchased or disabling
    UPDATE public.streams SET has_rgb_effect = p_enable WHERE id = p_stream_id;
    RETURN jsonb_build_object('success', true, 'message', CASE WHEN p_enable THEN 'Enabled' ELSE 'Disabled' END);
  END IF;

END;
$$;