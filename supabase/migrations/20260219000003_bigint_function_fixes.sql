CREATE OR REPLACE FUNCTION purchase_coins(user_id_in uuid, amount_in bigint, payment_intent_id_in text)
RETURNS void AS $$
BEGIN
  UPDATE public.user_profiles
  SET troll_coins = troll_coins + amount_in,
      paid_coins = paid_coins + amount_in
  WHERE id = user_id_in;

  INSERT INTO public.coin_transactions (user_id, amount, type, metadata)
  VALUES (user_id_in, amount_in, 'purchase', jsonb_build_object('payment_intent_id', payment_intent_id_in));
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION send_gift(p_stream_id uuid, p_recipient_id uuid, p_gift_id uuid, p_quantity bigint)
RETURNS jsonb AS $$
DECLARE
    v_sender_id UUID;
    v_cost NUMERIC;
    v_name TEXT;
    v_total_cost NUMERIC;
    v_sender_balance NUMERIC;
    v_recipient_share NUMERIC;
BEGIN
    v_sender_id := auth.uid();

    IF v_sender_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'You must be logged in to send gifts.');
    END IF;

    IF p_quantity < 1 THEN
        p_quantity := 1;
    END IF;

    SELECT cost, name INTO v_cost, v_name
    FROM public.gifts
    WHERE id = p_gift_id;

    IF v_cost IS NULL THEN
        SELECT value, name INTO v_cost, v_name
        FROM public.gift_items
        WHERE id = p_gift_id;
    END IF;

    IF v_cost IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Gift not found.');
    END IF;

    v_total_cost := v_cost * p_quantity;

    SELECT troll_coins INTO v_sender_balance
    FROM public.user_profiles
    WHERE id = v_sender_id;

    IF v_sender_balance IS NULL OR v_sender_balance < v_total_cost THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient coins.');
    END IF;

    UPDATE public.user_profiles
    SET troll_coins = troll_coins - v_total_cost
    WHERE id = v_sender_id;

    v_recipient_share := FLOOR(v_total_cost * 0.95);

    UPDATE public.user_profiles
    SET troll_coins = troll_coins + v_recipient_share,
        total_earned_coins = COALESCE(total_earned_coins, 0) + v_recipient_share
    WHERE id = p_recipient_id;

    INSERT INTO public.coin_transactions (user_id, amount, type, metadata)
    VALUES (v_sender_id, -v_total_cost, 'gift_sent', jsonb_build_object('gift_id', p_gift_id, 'gift_name', v_name, 'recipient_id', p_recipient_id, 'stream_id', p_stream_id, 'quantity', p_quantity)),
           (p_recipient_id, v_recipient_share, 'gift_received', jsonb_build_object('gift_id', p_gift_id, 'gift_name', v_name, 'sender_id', v_sender_id, 'stream_id', p_stream_id, 'quantity', p_quantity));

    IF p_stream_id IS NOT NULL THEN
        INSERT INTO public.stream_messages (stream_id, user_id, content, type)
        VALUES (p_stream_id, v_sender_id, 'GIFT_EVENT:' || v_name || ':' || p_quantity || ':' || v_total_cost, 'system');
    END IF;

    RETURN jsonb_build_object('success', true, 'new_balance', v_sender_balance - v_total_cost, 'message', 'Sent ' || v_name);
END;
$$ LANGUAGE plpgsql;