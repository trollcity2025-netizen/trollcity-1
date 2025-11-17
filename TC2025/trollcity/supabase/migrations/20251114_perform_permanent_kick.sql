-- Migration: create perform_permanent_kick function to securely debit coins and create stream ban
-- This function atomically debits coins from the broadcaster, records a coin transaction,
-- inserts a user_stream_bans record, and logs a moderation_actions entry.

CREATE OR REPLACE FUNCTION public.perform_permanent_kick(
  broadcaster_id UUID,
  target_user_id UUID,
  stream_id UUID,
  coin_cost INTEGER DEFAULT 1000
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  new_balance INTEGER;
BEGIN
  -- Attempt to deduct coins atomically
  UPDATE public.profiles
  SET coins = coins - coin_cost,
      updated_date = now()
  WHERE id = broadcaster_id
    AND (coins IS NOT NULL AND coins >= coin_cost)
  RETURNING coins INTO new_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  -- Record coin transaction (use fields present in coin_transactions table)
  INSERT INTO public.coin_transactions (user_id, amount, type, reason, source, created_date)
  VALUES (broadcaster_id, -coin_cost, 'debit', 'permanent_kick', 'perform_permanent_kick', now());

  -- Create the stream ban
  INSERT INTO public.user_stream_bans (streamer_id, user_id, stream_id, coin_cost, is_active, created_date)
  VALUES (broadcaster_id, target_user_id, stream_id, coin_cost, true, now());

  -- Log moderation action
  INSERT INTO public.moderation_actions (user_id, action_type, target_type, target_id, stream_id, moderator_id, notes, created_date)
  VALUES (target_user_id, 'permanent_kick', 'user', target_user_id, stream_id, broadcaster_id, 'Permanent kick paid by broadcaster via perform_permanent_kick', now());

  RETURN;
END;
$$;
