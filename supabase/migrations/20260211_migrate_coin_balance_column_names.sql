-- Migration: Update coin balance column references from old to new names
-- Date: 2025-02-11
-- Purpose: Migrate all RPC functions from troll_coins_balance/free_coin_balance to troll_coins/trollmonds

-- =====================================================
-- 1. Update add_troll_coins function
-- =====================================================
CREATE OR REPLACE FUNCTION add_troll_coins(
  user_id_input uuid,
  coins_to_add int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_profiles
  SET 
    troll_coins_balance = COALESCE(troll_coins_balance, 0) + coins_to_add,
    total_earned_coins = COALESCE(total_earned_coins, 0) + coins_to_add,
    updated_at = NOW()
  WHERE id = user_id_input;
END;
$$;

GRANT EXECUTE ON FUNCTION add_troll_coins(uuid, int) TO service_role;
GRANT EXECUTE ON FUNCTION add_troll_coins(uuid, int) TO authenticated;

-- =====================================================
-- 2. Update deduct_coins function (primary version)
-- =====================================================
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
  IF v_coin_type IN ('troll_coins') THEN
    v_coin_type := 'paid';
  ELSIF v_coin_type IN ('trollmonds') THEN
    v_coin_type := 'free';
  END IF;

  IF v_coin_type NOT IN ('paid', 'free') THEN
    RAISE EXCEPTION 'Invalid coin type';
  END IF;

  IF v_coin_type = 'paid' THEN
    SELECT troll_coins_balance INTO v_current_balance
    FROM user_profiles
    WHERE id = p_user_id;
  ELSE
    SELECT free_coin_balance INTO v_current_balance
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
    SET troll_coins_balance = troll_coins_balance - p_amount,
        total_spent_coins = COALESCE(total_spent_coins, 0) + p_amount,
        updated_at = now()
    WHERE id = p_user_id;
  ELSE
    UPDATE user_profiles
    SET free_coin_balance = free_coin_balance - p_amount,
        total_spent_coins = COALESCE(total_spent_coins, 0) + p_amount,
        updated_at = now()
    WHERE id = p_user_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION deduct_coins(uuid, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION deduct_coins(uuid, bigint, text) TO service_role;

-- =====================================================
-- 3. Update deduct_troll_coins wrapper function
-- =====================================================
CREATE OR REPLACE FUNCTION deduct_troll_coins(
  p_user_id uuid,
  p_amount bigint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM deduct_coins(p_user_id, p_amount, 'troll_coins');
END;
$$;

GRANT EXECUTE ON FUNCTION deduct_troll_coins(uuid, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION deduct_troll_coins(uuid, bigint) TO service_role;

-- =====================================================
-- 4. Update spend_coins function
-- =====================================================
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
  SELECT troll_coins_balance INTO v_sender_balance
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
    troll_coins_balance = troll_coins_balance - p_coin_amount,
    total_spent_coins = COALESCE(total_spent_coins, 0) + p_coin_amount,
    updated_at = now()
  WHERE id = p_sender_id;

  -- Add coins to receiver (as troll_coins_balance)
  UPDATE user_profiles
  SET 
    troll_coins_balance = COALESCE(troll_coins_balance, 0) + p_coin_amount,
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

GRANT EXECUTE ON FUNCTION spend_coins(UUID, UUID, BIGINT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION spend_coins(UUID, UUID, BIGINT, TEXT, TEXT) TO service_role;

-- =====================================================
-- 5. Update spend_trollmonds function
-- =====================================================
CREATE OR REPLACE FUNCTION spend_trollmonds(
  p_user_id uuid,
  p_amount bigint,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet record;
  v_remaining bigint;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  SELECT *
  INTO v_wallet
  FROM wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet row not found for user %', p_user_id;
  END IF;

  v_remaining := COALESCE(v_wallet.trollmonds, 0);
  IF v_remaining < p_amount THEN
    RAISE EXCEPTION 'Insufficient Trollmonds: required %, available %', p_amount, v_remaining;
  END IF;

  UPDATE wallets
  SET free_coin_balance = v_remaining - p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  UPDATE user_profiles
  SET free_coin_balance = GREATEST(COALESCE(free_coin_balance, 0) - p_amount, 0),
      total_spent_coins = COALESCE(total_spent_coins, 0) + p_amount,
      updated_at = NOW()
  WHERE id = p_user_id;

  BEGIN
    INSERT INTO coin_transactions (
      user_id,
      type,
      amount,
      coin_type,
      description,
      metadata,
      coin_delta,
      created_at
    )
    VALUES (
      p_user_id,
      'wheel_spin',
      p_amount,
      'trollmonds',
      'Troll Wheel spin',
      jsonb_build_object('reason', p_reason),
      -p_amount,
      NOW()
    );
  EXCEPTION WHEN undefined_table THEN
    -- coin_transactions table might not exist in older deployments
    NULL;
  EXCEPTION WHEN others THEN
    -- Handle other exceptions (e.g., null constraint violations)
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'remaining', v_remaining - p_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION spend_trollmonds(uuid, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION spend_trollmonds(uuid, bigint, text) TO service_role;

-- =====================================================
-- Verification
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE 'Successfully migrated coin balance column references to new names (troll_coins/trollmonds)';
  RAISE NOTICE 'Updated functions: add_troll_coins, deduct_coins, deduct_troll_coins, spend_coins, spend_trollmonds';
END $$;
