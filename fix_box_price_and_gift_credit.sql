-- Fix Box Price Credit and Gift System
-- This file fixes multiple issues with box pricing and gift sending

-- ============================================================
-- 1. FIX: Credit broadcaster when user joins a box with price
-- ============================================================
-- Update join_seat_atomic to credit the broadcaster

CREATE OR REPLACE FUNCTION public.join_seat_atomic(
    p_stream_id UUID,
    p_seat_index INTEGER,
    p_price INTEGER,
    p_user_id UUID DEFAULT NULL,
    p_guest_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session_id UUID;
    v_user_balance BIGINT;
    v_effective_price INTEGER := COALESCE(p_price, 0);
    v_has_paid BOOLEAN := FALSE;
    v_are_seats_locked BOOLEAN := FALSE;
    v_broadcaster_id UUID;
    v_broadcaster_share INTEGER;
BEGIN
    -- Check if seats are locked for this stream
    SELECT COALESCE(are_seats_locked, false) INTO v_are_seats_locked
    FROM public.streams
    WHERE id = p_stream_id;
    
    IF v_are_seats_locked THEN
        RETURN jsonb_build_object('success', false, 'message', 'Seats are currently locked');
    END IF;
    
    -- Validate inputs
    IF p_user_id IS NULL AND p_guest_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'User ID or Guest ID required');
    END IF;

    -- Check if seat is occupied
    IF EXISTS (
        SELECT 1 FROM public.stream_seat_sessions 
        WHERE stream_id = p_stream_id 
        AND seat_index = p_seat_index 
        AND status = 'active'
    ) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Seat is occupied');
    END IF;

    -- If user/guest already paid in this stream, skip charging again
    IF p_user_id IS NOT NULL AND v_effective_price > 0 THEN
        SELECT EXISTS (
            SELECT 1 FROM public.stream_seat_sessions
            WHERE stream_id = p_stream_id
              AND user_id = p_user_id
              AND COALESCE(price_paid, 0) > 0
        ) INTO v_has_paid;
    ELSIF p_guest_id IS NOT NULL AND v_effective_price > 0 THEN
        SELECT EXISTS (
            SELECT 1 FROM public.stream_seat_sessions
            WHERE stream_id = p_stream_id
              AND guest_id = p_guest_id
              AND COALESCE(price_paid, 0) > 0
        ) INTO v_has_paid;
    END IF;

    IF v_has_paid THEN
        v_effective_price := 0;
    END IF;

    -- If Registered User -> Check Balance for Price
    IF p_user_id IS NOT NULL AND v_effective_price > 0 THEN
        SELECT troll_coins INTO v_user_balance FROM public.user_profiles WHERE id = p_user_id;
        IF COALESCE(v_user_balance, 0) < v_effective_price THEN
            RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
        END IF;
        
        -- Deduct coins from user
        UPDATE public.user_profiles 
        SET troll_coins = troll_coins - v_effective_price 
        WHERE id = p_user_id;
        
        -- Credit broadcaster with 95% of the price
        SELECT user_id INTO v_broadcaster_id FROM public.streams WHERE id = p_stream_id;
        IF v_broadcaster_id IS NOT NULL AND v_broadcaster_id != p_user_id THEN
            v_broadcaster_share := FLOOR(v_effective_price * 0.95);
            UPDATE public.user_profiles 
            SET troll_coins = troll_coins + v_broadcaster_share,
                total_earned_coins = COALESCE(total_earned_coins, 0) + v_broadcaster_share
            WHERE id = v_broadcaster_id;
            
            -- Log transaction
            INSERT INTO public.coin_transactions (user_id, amount, type, metadata)
            VALUES 
                (p_user_id, -v_effective_price, 'seat_payment', jsonb_build_object(
                    'stream_id', p_stream_id,
                    'seat_index', p_seat_index,
                    'price', v_effective_price
                )),
                (v_broadcaster_id, v_broadcaster_share, 'seat_earning', jsonb_build_object(
                    'stream_id', p_stream_id,
                    'seat_index', p_seat_index,
                    'payer_id', p_user_id,
                    'gross', v_effective_price,
                    'net', v_broadcaster_share
                ));
        END IF;
    END IF;

    -- Insert Session
    INSERT INTO public.stream_seat_sessions (stream_id, seat_index, user_id, guest_id, price_paid, status, joined_at)
    VALUES (p_stream_id, p_seat_index, p_user_id, p_guest_id, v_effective_price, 'active', NOW())
    RETURNING id INTO v_session_id;

    RETURN jsonb_build_object('success', true, 'session_id', v_session_id);
END;
$$;

-- ============================================================
-- 2. FIX: Update send_gift_in_stream to handle guests properly
-- ============================================================
-- When sending to a guest, credit the broadcaster instead

CREATE OR REPLACE FUNCTION public.send_gift_in_stream(
  p_sender_id UUID,
  p_receiver_id UUID,
  p_stream_id UUID,
  p_gift_id TEXT,
  p_quantity INTEGER,
  p_metadata JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender_balance BIGINT;
  v_gift_cost BIGINT;
  v_total_cost BIGINT;
  v_gift_name TEXT;
  v_battle_id UUID;
  v_is_challenger BOOLEAN;
  v_broadcaster_id UUID;
  v_recipient_share BIGINT;
  v_actual_receiver_id UUID;
BEGIN
  -- 1. Get gift cost and name
  SELECT cost, name INTO v_gift_cost, v_gift_name
  FROM public.gifts
  WHERE id::text = p_gift_id OR slug = p_gift_id;

  IF v_gift_cost IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Gift not found');
  END IF;

  v_total_cost := v_gift_cost * COALESCE(p_quantity, 1);

  -- 2. Check sender's balance
  SELECT troll_coins INTO v_sender_balance FROM public.user_profiles WHERE id = p_sender_id;
  IF v_sender_balance IS NULL OR v_sender_balance < v_total_cost THEN
    RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
  END IF;

  -- 3. Deduct cost from sender
  UPDATE public.user_profiles
  SET troll_coins = troll_coins - v_total_cost
  WHERE id = p_sender_id;

  -- 4. Determine who receives the credit
  -- If receiver is the same as sender, return error
  IF p_receiver_id = p_sender_id THEN
    -- Rollback the deduction
    UPDATE public.user_profiles
    SET troll_coins = troll_coins + v_total_cost
    WHERE id = p_sender_id;
    RETURN jsonb_build_object('success', false, 'message', 'You cannot send gifts to yourself');
  END IF;

  -- Check if receiver has a user profile (is a registered user)
  -- If not, credit the broadcaster instead
  v_actual_receiver_id := p_receiver_id;
  
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_receiver_id) THEN
    -- Receiver is a guest - credit the broadcaster instead
    SELECT user_id INTO v_broadcaster_id FROM public.streams WHERE id = p_stream_id;
    IF v_broadcaster_id IS NOT NULL THEN
      v_actual_receiver_id := v_broadcaster_id;
    ELSE
      -- No broadcaster found, just discard the gift value (or could refund sender)
      v_actual_receiver_id := NULL;
    END IF;
  END IF;

  -- 5. Credit the actual recipient (95% share)
  IF v_actual_receiver_id IS NOT NULL THEN
    v_recipient_share := FLOOR(v_total_cost * 0.95);
    UPDATE public.user_profiles
    SET troll_coins = troll_coins + v_recipient_share,
        total_earned_coins = COALESCE(total_earned_coins, 0) + v_recipient_share
    WHERE id = v_actual_receiver_id;
  END IF;

  -- 6. Record gift in stream_gifts
  INSERT INTO public.stream_gifts (stream_id, sender_id, receiver_id, gift_id, quantity, metadata)
  VALUES (p_stream_id, p_sender_id, p_receiver_id, p_gift_id, p_quantity, p_metadata);

  -- 7. Insert message into stream
  INSERT INTO stream_messages (stream_id, user_id, content)
  VALUES (p_stream_id, p_sender_id, 'GIFT_EVENT:' || v_gift_name || ':' || COALESCE(p_quantity, 1));

  -- 8. Battle Scoring Logic
  SELECT id, (challenger_stream_id = p_stream_id) INTO v_battle_id, v_is_challenger
  FROM public.battles
  WHERE (challenger_stream_id = p_stream_id OR opponent_stream_id = p_stream_id)
    AND status = 'active'
  LIMIT 1;

  IF v_battle_id IS NOT NULL THEN
    IF v_is_challenger THEN
      UPDATE public.battles
      SET score_challenger = COALESCE(score_challenger, 0) + v_total_cost,
          pot_challenger = COALESCE(pot_challenger, 0) + v_total_cost
      WHERE id = v_battle_id;
    ELSE
      UPDATE public.battles
      SET score_opponent = COALESCE(score_opponent, 0) + v_total_cost,
          pot_opponent = COALESCE(pot_opponent, 0) + v_total_cost
      WHERE id = v_battle_id;
    END IF;
  END IF;

  -- Log transactions
  INSERT INTO public.coin_transactions (user_id, amount, type, metadata)
  VALUES 
    (p_sender_id, -v_total_cost, 'gift_sent', jsonb_build_object(
        'gift_id', p_gift_id,
        'gift_name', v_gift_name,
        'receiver_id', p_receiver_id,
        'actual_receiver_id', v_actual_receiver_id,
        'stream_id', p_stream_id,
        'quantity', p_quantity
    ));
  
  IF v_actual_receiver_id IS NOT NULL THEN
    INSERT INTO public.coin_transactions (user_id, amount, type, metadata)
    VALUES (v_actual_receiver_id, v_recipient_share, 'gift_received', jsonb_build_object(
        'gift_id', p_gift_id,
        'gift_name', v_gift_name,
        'sender_id', p_sender_id,
        'stream_id', p_stream_id,
        'quantity', p_quantity
    ));
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Gift sent successfully');
END;
$$;

-- ============================================================
-- 3. Function to credit crowns on battle end or forfeit
-- ============================================================

-- Function to award crown to winner
CREATE OR REPLACE FUNCTION public.award_battle_crown(
    p_winner_stream_id UUID,
    p_loser_stream_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_winner_user_id UUID;
    v_loser_user_id UUID;
BEGIN
    -- Get winner's user ID
    SELECT user_id INTO v_winner_user_id FROM public.streams WHERE id = p_winner_stream_id;
    
    IF v_winner_user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Award crown to winner
    UPDATE public.user_profiles
    SET battle_crowns = COALESCE(battle_crowns, 0) + 1
    WHERE id = v_winner_user_id;
    
    -- If there's a loser, reset their streak
    IF p_loser_stream_id IS NOT NULL THEN
        SELECT user_id INTO v_loser_user_id FROM public.streams WHERE id = p_loser_stream_id;
        IF v_loser_user_id IS NOT NULL THEN
            UPDATE public.user_profiles
            SET battle_crown_streak = 0
            WHERE id = v_loser_user_id;
        END IF;
    END IF;
    
    RETURN TRUE;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.award_battle_crown(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_battle_crown(UUID) TO authenticated;
