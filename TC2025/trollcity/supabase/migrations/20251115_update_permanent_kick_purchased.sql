-- Update perform_permanent_kick to require purchased coins and debit both coins and purchased_coins
CREATE OR REPLACE FUNCTION public.perform_permanent_kick(
  broadcaster_id UUID,
  target_user_id UUID,
  stream_id UUID,
  coin_cost INTEGER DEFAULT 500
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  new_balance INTEGER;
  new_purchased INTEGER;
BEGIN
  -- Ensure sufficient purchased coins
  PERFORM 1 FROM public.profiles WHERE id = broadcaster_id AND purchased_coins >= coin_cost;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_purchased_coins';
  END IF;

  -- Deduct from both coins and purchased_coins
  UPDATE public.profiles
  SET coins = coins - coin_cost,
      purchased_coins = purchased_coins - coin_cost,
      updated_date = now()
  WHERE id = broadcaster_id
    AND coins >= coin_cost
    AND purchased_coins >= coin_cost
  RETURNING coins, purchased_coins INTO new_balance, new_purchased;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  INSERT INTO public.coin_transactions (user_id, amount, type, reason, source, created_date)
  VALUES (broadcaster_id, -coin_cost, 'debit', 'permanent_kick', 'perform_permanent_kick', now());

  INSERT INTO public.user_stream_bans (streamer_id, user_id, stream_id, coin_cost, is_active, created_date)
  VALUES (broadcaster_id, target_user_id, stream_id, coin_cost, true, now());

  INSERT INTO public.moderation_actions (user_id, action_type, target_type, target_id, stream_id, moderator_id, notes, created_date)
  VALUES (target_user_id, 'permanent_kick', 'user', target_user_id, stream_id, broadcaster_id, 'Permanent kick paid with purchased coins', now());

  RETURN;
END;
$$;
