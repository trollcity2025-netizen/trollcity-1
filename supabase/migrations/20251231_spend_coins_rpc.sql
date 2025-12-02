-- Create spend_coins RPC function for simple gift sending
-- This is a simplified version of process_gift for direct user-to-user gifts

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
  -- Check sender's paid coin balance
  SELECT paid_coin_balance INTO v_sender_balance
  FROM user_profiles
  WHERE id = p_sender_id;

  IF v_sender_balance IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Sender not found'
    );
  END IF;

  -- Check if sender has enough coins
  IF v_sender_balance < p_coin_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Not enough coins',
      'current_balance', v_sender_balance,
      'required', p_coin_amount
    );
  END IF;

  -- Deduct coins from sender
  UPDATE user_profiles
  SET 
    paid_coin_balance = paid_coin_balance - p_coin_amount,
    total_spent_coins = COALESCE(total_spent_coins, 0) + p_coin_amount,
    updated_at = now()
  WHERE id = p_sender_id;

  -- Add coins to receiver (as paid coins)
  UPDATE user_profiles
  SET 
    paid_coin_balance = COALESCE(paid_coin_balance, 0) + p_coin_amount,
    total_earned_coins = COALESCE(total_earned_coins, 0) + p_coin_amount,
    updated_at = now()
  WHERE id = p_receiver_id;

  -- Insert gift record
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

  -- Insert coin transaction record (if table exists)
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
      'paid',
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
    -- coin_transactions table might not exist, ignore
    NULL;
  END;

  -- Create notification for receiver (if function exists)
  BEGIN
    PERFORM create_notification(
      p_receiver_id,
      'gift_received',
      '🎁 Gift Received!',
      format('You received %s coins from a gift!', p_coin_amount),
      jsonb_build_object(
        'sender_id', p_sender_id,
        'coins_spent', p_coin_amount,
        'gift_id', v_gift_id,
        'item', p_item
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- create_notification function might not exist, ignore
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'gift_id', v_gift_id,
    'coins_spent', p_coin_amount
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION spend_coins(UUID, UUID, BIGINT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION spend_coins(UUID, UUID, BIGINT, TEXT, TEXT) TO service_role;

-- Add comment
COMMENT ON FUNCTION spend_coins IS 'Simple function to send coins from one user to another. Deducts from sender and adds to receiver as paid coins.';

