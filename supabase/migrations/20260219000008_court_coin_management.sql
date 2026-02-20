
-- Grant coins to a user from the court
CREATE OR REPLACE FUNCTION court_grant_coins(p_user_id uuid, p_amount bigint, p_reason text)
RETURNS void AS $$
BEGIN
  -- Add coins to user's balance
  UPDATE public.user_profiles
  SET troll_coins = troll_coins + p_amount
  WHERE id = p_user_id;

  -- Create a record of the transaction
  INSERT INTO public.coin_transactions(user_id, amount, type, description, metadata)
  VALUES (p_user_id, p_amount, 'court_grant', p_reason, jsonb_build_object('granted_by', auth.uid()));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Deduct coins from a user by the court
CREATE OR REPLACE FUNCTION court_deduct_coins(p_user_id uuid, p_amount bigint, p_reason text)
RETURNS void AS $$
DECLARE
  v_balance bigint;
BEGIN
  -- Check user's balance
  SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = p_user_id;

  IF v_balance >= p_amount THEN
    -- Deduct coins from user's balance
    UPDATE public.user_profiles
    SET troll_coins = troll_coins - p_amount
    WHERE id = p_user_id;

    -- Create a record of the transaction
    INSERT INTO public.coin_transactions(user_id, amount, type, description, metadata)
    VALUES (p_user_id, -p_amount, 'court_deduction', p_reason, jsonb_build_object('deducted_by', auth.uid()));
  ELSE
    RAISE EXCEPTION 'Insufficient funds';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
