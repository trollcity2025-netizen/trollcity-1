CREATE OR REPLACE FUNCTION public.set_stream_has_rgb_effect(p_stream_id uuid, p_has_rgb_effect boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_cost BIGINT := 50000; -- Ensure cost is BIGINT
  v_user_balance BIGINT; -- Ensure balance is BIGINT
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  IF p_has_rgb_effect THEN
    -- Check user balance
    SELECT troll_coins INTO v_user_balance FROM public.user_profiles WHERE id = v_user_id;

    IF v_user_balance < v_cost THEN
      RAISE EXCEPTION 'Insufficient funds to enable RGB effect. Cost: %, Balance: %', v_cost, v_user_balance;
    END IF;

    -- Deduct cost and log transaction
    UPDATE public.user_profiles
    SET troll_coins = troll_coins - v_cost
    WHERE id = v_user_id;

    INSERT INTO public.coin_transactions (user_id, amount, type, metadata)
    VALUES (v_user_id, -v_cost, 'visual_effect_purchase', jsonb_build_object('stream_id', p_stream_id, 'effect', 'rgb'));

  END IF;

  -- Update the stream
  UPDATE public.streams
  SET has_rgb_effect = p_has_rgb_effect
  WHERE id = p_stream_id AND user_id = v_user_id;
END;
$$;