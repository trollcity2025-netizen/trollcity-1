-- Migration: Update RPCs to use troll_coins/trollmonds columns
-- Date: 2026-03-05

CREATE OR REPLACE FUNCTION deduct_coins(
  p_user_id uuid,
  p_amount bigint,
  p_coin_type text DEFAULT 'paid'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance bigint;
  v_coin_type text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  v_coin_type := LOWER(COALESCE(p_coin_type, 'paid'));
  IF v_coin_type IN ('troll_coins', 'paid') THEN
    v_coin_type := 'paid';
  ELSIF v_coin_type IN ('trollmonds', 'free') THEN
    v_coin_type := 'free';
  END IF;

  IF v_coin_type = 'paid' THEN
    SELECT troll_coins INTO v_current_balance
    FROM user_profiles
    WHERE id = p_user_id;
  ELSE
    SELECT trollmonds INTO v_current_balance
    FROM user_profiles
    WHERE id = p_user_id;
  END IF;

  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient % coins. Required: %, Available: %', v_coin_type, p_amount, v_current_balance;
  END IF;

  IF v_coin_type = 'paid' THEN
    UPDATE user_profiles
    SET troll_coins = troll_coins - p_amount,
        total_spent_coins = COALESCE(total_spent_coins, 0) + p_amount,
        updated_at = now()
    WHERE id = p_user_id;
  ELSE
    UPDATE user_profiles
    SET trollmonds = trollmonds - p_amount,
        updated_at = now()
    WHERE id = p_user_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION deduct_coins(uuid, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION deduct_coins(uuid, bigint, text) TO service_role;

CREATE OR REPLACE FUNCTION spend_coins(
  p_sender_id UUID,
  p_receiver_id UUID,
  p_coin_amount BIGINT,
  p_source TEXT DEFAULT 'gift',
  p_item TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_balance BIGINT;
  v_gift_id UUID := gen_random_uuid();
BEGIN
  SELECT troll_coins INTO v_sender_balance
  FROM user_profiles
  WHERE id = p_sender_id;

  IF v_sender_balance IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Sender not found'
    );
  END IF;

  IF v_sender_balance < p_coin_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Not enough coins',
      'current_balance', v_sender_balance,
      'required', p_coin_amount
    );
  END IF;

  UPDATE user_profiles
  SET troll_coins = troll_coins - p_coin_amount,
      total_spent_coins = COALESCE(total_spent_coins, 0) + p_coin_amount,
      updated_at = now()
  WHERE id = p_sender_id;

  UPDATE user_profiles
  SET troll_coins = COALESCE(troll_coins, 0) + p_coin_amount,
      total_earned_coins = COALESCE(total_earned_coins, 0) + p_coin_amount,
      updated_at = now()
  WHERE id = p_receiver_id;

  INSERT INTO gifts (
    id,
    sender_id,
    receiver_id,
    coins_spent,
    gift_type,
    message,
    created_at
  )
  VALUES (
    v_gift_id,
    p_sender_id,
    p_receiver_id,
    p_coin_amount,
    'paid',
    COALESCE(p_item, 'Gift'),
    now()
  );

  BEGIN
    INSERT INTO coin_transactions (
      user_id,
      type,
      amount,
      coin_type,
      description,
      metadata,
      created_at
    )
    VALUES (
      p_sender_id,
      'gift',
      p_coin_amount,
      'troll_coins',
      format('Sent gift: %s', COALESCE(p_item, 'Gift')),
      jsonb_build_object(
        'receiver_id', p_receiver_id,
        'source', p_source,
        'item', p_item,
        'gift_id', v_gift_id
      ),
      now()
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    PERFORM create_notification(
      p_receiver_id,
      'gift_received',
      'dYZ? Gift Received!',
      format('You received %s coins from a gift!', p_coin_amount),
      jsonb_build_object(
        'sender_id', p_sender_id,
        'coins_spent', p_coin_amount,
        'gift_id', v_gift_id,
        'item', p_item
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'gift_id', v_gift_id,
    'coins_spent', p_coin_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION spend_coins(UUID, UUID, BIGINT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION spend_coins(UUID, UUID, BIGINT, TEXT, TEXT) TO service_role;
