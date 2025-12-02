-- Fix process_gift function to ensure broadcaster always receives paid coins
-- and properly distinguishes between free coins and paid coins (troll coins)

CREATE OR REPLACE FUNCTION process_gift(
  p_sender_id uuid,
  p_streamer_id uuid,
  p_stream_id uuid,
  p_gift_id text,
  p_gift_name text,
  p_coins_spent bigint,
  p_gift_type text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_gift_id uuid := gen_random_uuid();
  evt text;
BEGIN
  -- Deduct from sender based on gift type (paid = troll coins, free = free coins)
  IF p_gift_type = 'paid' THEN
    UPDATE user_profiles
      SET paid_coin_balance = paid_coin_balance - p_coins_spent,
          total_spent_coins = total_spent_coins + p_coins_spent,
          updated_at = now()
      WHERE id = p_sender_id;
  ELSE
    UPDATE user_profiles
      SET free_coin_balance = free_coin_balance - p_coins_spent,
          total_spent_coins = total_spent_coins + p_coins_spent,
          updated_at = now()
      WHERE id = p_sender_id;
  END IF;

  -- Broadcaster ALWAYS receives the full gift amount as PAID COINS (troll coins)
  -- regardless of whether sender used paid or free coins
  UPDATE user_profiles
    SET paid_coin_balance = paid_coin_balance + p_coins_spent,
        total_earned_coins = total_earned_coins + p_coins_spent,
        updated_at = now()
    WHERE id = p_streamer_id;

  -- Insert gift record
  INSERT INTO gifts(id, stream_id, sender_id, receiver_id, coins_spent, gift_type, message, created_at)
    VALUES (v_gift_id, p_stream_id, p_sender_id, p_streamer_id, p_coins_spent, p_gift_type, p_gift_name, now());

  -- Record transaction for sender
  INSERT INTO transactions(id, user_id, type, transaction_type, coins_used, description, created_at)
    VALUES (gen_random_uuid(), p_sender_id, 'gift', 'gift', p_coins_spent, p_gift_name, now());

  -- Update stream stats if stream_id is provided
  IF p_stream_id IS NOT NULL THEN
    UPDATE streams
      SET total_gifts_coins = COALESCE(total_gifts_coins,0) + p_coins_spent,
          total_unique_gifters = COALESCE(total_unique_gifters,0) + 1,
          updated_at = now()
      WHERE id = p_stream_id;
  END IF;

  -- Record DNA event
  IF p_gift_id IN ('diamond','car') THEN
    evt := 'EPIC_GIFT_CHAOS';
  ELSIF p_gift_id = 'crown' THEN
    evt := 'LEGACY_EVENT';
  ELSE
    evt := CASE WHEN p_gift_type = 'paid' THEN 'SENT_CHAOS_GIFT' ELSE 'HELPED_SMALL_STREAMER' END;
  END IF;

  BEGIN
    PERFORM record_dna_event(p_sender_id, evt, jsonb_build_object('gift_id', p_gift_id, 'coins', p_coins_spent));
    PERFORM add_xp(p_sender_id, GREATEST(1, p_coins_spent/50), 'gift_sent');
  EXCEPTION WHEN OTHERS THEN
    -- Ignore errors in event recording
    NULL;
  END;

  RETURN jsonb_build_object('success', true, 'gift_id', v_gift_id);
END;
$$;

