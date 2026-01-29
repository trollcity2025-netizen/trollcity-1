CREATE OR REPLACE FUNCTION public.spend_coins(
    p_sender_id uuid,
    p_receiver_id uuid,
    p_coin_amount bigint,
    p_source text DEFAULT 'gift'::text,
    p_item text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender_balance BIGINT;
  v_sender_created_at TIMESTAMPTZ;
  v_gift_id UUID := gen_random_uuid();
  v_bank_result json;
  v_credit_increase INTEGER;
  v_current_score INTEGER;
  v_new_score INTEGER;
BEGIN
  -- Check sender's paid coin balance and get created_at
  SELECT Troll_coins, created_at INTO v_sender_balance, v_sender_created_at
  FROM user_profiles
  WHERE id = p_sender_id;

  IF v_sender_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sender not found');
  END IF;

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
    Troll_coins = Troll_coins - p_coin_amount,
    total_spent_coins = COALESCE(total_spent_coins, 0) + p_coin_amount,
    updated_at = now()
  WHERE id = p_sender_id;

  -- Grant XP to Sender (Spending XP) - 1 XP per coin spent
  PERFORM public.grant_xp(
    p_sender_id,
    p_coin_amount,
    'spend_coins',
    v_gift_id::text
  );

  -- Log Sender Transaction
  INSERT INTO coin_transactions (
    user_id, type, amount, coin_type, description, metadata, created_at
  ) VALUES (
    p_sender_id, 'gift_sent', -p_coin_amount, 'troll_coins', 
    format('Sent gift: %s', COALESCE(p_item, 'Gift')),
    jsonb_build_object('receiver_id', p_receiver_id, 'source', p_source, 'item', p_item, 'gift_id', v_gift_id),
    now()
  );

  -- Credit Receiver via Troll Bank
  SELECT public.troll_bank_credit_coins(
    p_receiver_id,
    p_coin_amount::int,
    'gifted',
    'gift',
    v_gift_id::text,
    jsonb_build_object('sender_id', p_sender_id, 'item', p_item, 'source', p_source)
  ) INTO v_bank_result;

  -- Grant XP to Receiver (Receiving Gift XP) - 1 XP per coin value
  PERFORM public.grant_xp(
    p_receiver_id,
    p_coin_amount,
    'gift_received',
    v_gift_id::text
  );

  -- Insert gift record
  INSERT INTO gifts (
    id, sender_id, receiver_id, coins_spent, gift_type, message, created_at
  ) VALUES (
    v_gift_id, p_sender_id, p_receiver_id, p_coin_amount, 'paid', COALESCE(p_item, 'Gift'), now()
  );

  -- =================================================================
  -- CREDIT SCORE LOGIC UPDATE
  -- Rule: Increase credit score if account > 2 months old.
  -- Rate: 1 point for every 1000 coins.
  -- =================================================================
  
  -- Calculate potential increase
  v_credit_increase := FLOOR(p_coin_amount / 1000);

  -- Check eligibility: Account age > 2 months AND increase > 0
  IF v_credit_increase > 0 AND v_sender_created_at < (now() - INTERVAL '2 months') THEN
      
      -- Lock and get current score
      SELECT score INTO v_current_score
      FROM public.user_credit
      WHERE user_id = p_sender_id
      FOR UPDATE;

      -- If no credit record exists, one should be created (triggers usually handle this, but to be safe)
      IF v_current_score IS NULL THEN
          INSERT INTO public.user_credit (user_id, score, tier, trend_7d, updated_at)
          VALUES (p_sender_id, 400, 'Building', 0, now())
          RETURNING score INTO v_current_score;
      END IF;

      -- Calculate new score (Max 800)
      v_new_score := LEAST(800, v_current_score + v_credit_increase);

      IF v_new_score > v_current_score THEN
          -- Update User Credit
          UPDATE public.user_credit
          SET 
              score = v_new_score,
              tier = public.get_credit_tier(v_new_score),
              updated_at = now(),
              last_event_at = now()
          WHERE user_id = p_sender_id;

          -- Log Credit Event
          INSERT INTO public.credit_events (
              user_id,
              event_type,
              delta,
              source_table,
              source_id,
              metadata
          ) VALUES (
              p_sender_id,
              'gift_sent_bonus',
              v_new_score - v_current_score, -- Actual delta applied
              'gifts',
              v_gift_id,
              jsonb_build_object('coins_spent', p_coin_amount, 'calculation', '1 pt per 1000 coins')
          );
      END IF;
  END IF;

  -- Notification
  BEGIN
    PERFORM create_notification(
       p_receiver_id,
       'gift_received',
       'You received a gift!',
       jsonb_build_object(
         'sender_id', p_sender_id,
         'amount', p_coin_amount,
         'item', p_item,
         'gift_id', v_gift_id
       )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Ignore notification errors
  END;

  RETURN jsonb_build_object('success', true, 'gift_id', v_gift_id);
END;
$$;
