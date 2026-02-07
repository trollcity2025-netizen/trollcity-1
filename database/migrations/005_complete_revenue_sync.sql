-- Complete Revenue & Inventory Sync for Additional Items
-- Seeds Broadcast Seat and Stream RGB into purchasable_items
-- Updates RPCs to log to purchase_ledger

-- 1. Seed Additional Items
INSERT INTO public.purchasable_items (item_key, display_name, category, coin_price, is_coin_pack, frontend_source, metadata)
VALUES 
('broadcast-seat', 'Broadcast Seat', 'seat', NULL, false, 'BroadcastGrid', '{"dynamic_price": true}'),
('stream-rgb', 'Stream RGB Effect', 'stream_feature', 10, false, 'BroadcastControls', '{}')
ON CONFLICT (item_key) DO NOTHING;

-- 2. Drop existing functions to avoid return type conflicts
DROP FUNCTION IF EXISTS public.join_seat_atomic(UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.purchase_rgb_broadcast(UUID, BOOLEAN);

-- 3. Update join_seat_atomic to log to purchase_ledger
CREATE OR REPLACE FUNCTION public.join_seat_atomic(
    p_stream_id UUID,
    p_seat_index INTEGER,
    p_price INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_balance INTEGER;
    v_active_session_id UUID;
    v_already_paid BOOLEAN := FALSE;
    v_stream_owner UUID;
    v_new_session_id UUID;
    v_ledger_item_id UUID;
BEGIN
    -- 1. Validate Stream & Owner
    SELECT user_id INTO v_stream_owner FROM public.streams WHERE id = p_stream_id;
    IF v_stream_owner IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Stream not found');
    END IF;

    -- 2. Check if seat is occupied
    IF EXISTS (
        SELECT 1 FROM public.stream_seat_sessions 
        WHERE stream_id = p_stream_id 
        AND seat_index = p_seat_index 
        AND status = 'active'
    ) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Seat already taken');
    END IF;

    -- 3. Check Payment History
    IF EXISTS (
        SELECT 1 FROM public.stream_seat_sessions
        WHERE stream_id = p_stream_id
        AND user_id = v_user_id
        AND seat_index = p_seat_index
        AND price_paid >= p_price
    ) THEN
        v_already_paid := TRUE;
    END IF;

    -- 4. Process Payment
    IF p_price > 0 AND NOT v_already_paid THEN
        -- Lock & Check Balance
        SELECT troll_coins INTO v_user_balance FROM public.user_profiles WHERE id = v_user_id FOR UPDATE;
        
        IF v_user_balance < p_price THEN
            RETURN jsonb_build_object('success', false, 'message', 'Insufficient coins');
        END IF;

        -- Deduct from User
        UPDATE public.user_profiles 
        SET troll_coins = troll_coins - p_price 
        WHERE id = v_user_id;

        -- Credit to Host (90%)
        UPDATE public.user_profiles
        SET troll_coins = troll_coins + FLOOR(p_price * 0.9)
        WHERE id = v_stream_owner;
        
        -- Log to Purchase Ledger (CRITICAL SYNC)
        SELECT id INTO v_ledger_item_id FROM public.purchasable_items WHERE item_key = 'broadcast-seat';
        
        IF v_ledger_item_id IS NOT NULL THEN
            INSERT INTO public.purchase_ledger (
                user_id, item_id, coin_amount, payment_method, source_context, created_at
            ) VALUES (
                v_user_id, v_ledger_item_id, p_price, 'coins', p_stream_id::text, now()
            );
        END IF;

        -- Log Transaction (Legacy)
        INSERT INTO public.coin_transactions (user_id, amount, type, metadata)
        VALUES (v_user_id, -p_price, 'purchase', jsonb_build_object('description', 'Seat ' || p_seat_index || ' in stream ' || p_stream_id));
    END IF;

    -- 5. Create Session
    INSERT INTO public.stream_seat_sessions (
        stream_id, user_id, seat_index, price_paid, status, joined_at
    ) VALUES (
        p_stream_id, v_user_id, p_seat_index, CASE WHEN v_already_paid THEN 0 ELSE p_price END, 'active', now()
    ) RETURNING id INTO v_new_session_id;

    RETURN jsonb_build_object(
        'success', true, 
        'session_id', v_new_session_id,
        'paid', CASE WHEN v_already_paid THEN 0 ELSE p_price END
    );

EXCEPTION 
    WHEN unique_violation THEN
        RETURN jsonb_build_object('success', false, 'message', 'Seat already taken (race)');
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- 4. Update purchase_rgb_broadcast to log to purchase_ledger
CREATE OR REPLACE FUNCTION public.purchase_rgb_broadcast(
  p_stream_id UUID,
  p_enable BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_stream RECORD;
  v_balance INT;
  v_cost INT := 10;
  v_ledger_item_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  -- 1. Verify Stream Ownership
  SELECT * INTO v_stream 
  FROM public.streams 
  WHERE id = p_stream_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Stream not found');
  END IF;
  
  IF v_stream.user_id != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  -- 2. Handle Logic
  IF v_stream.rgb_purchased THEN
    -- Already purchased, just toggle
    UPDATE public.streams
    SET has_rgb_effect = p_enable
    WHERE id = p_stream_id;
    
    RETURN jsonb_build_object('success', true, 'message', 'Toggled RGB');
  ELSE
    -- Not purchased yet
    IF NOT p_enable THEN
       RETURN jsonb_build_object('success', false, 'error', 'Must purchase to enable');
    END IF;

    -- Check Balance
    SELECT troll_coins INTO v_balance
    FROM public.user_profiles
    WHERE id = v_user_id;
    
    IF v_balance < v_cost THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds');
    END IF;

    -- Deduct Coins
    UPDATE public.user_profiles
    SET troll_coins = troll_coins - v_cost
    WHERE id = v_user_id;
    
    -- Enable & Mark Purchased
    UPDATE public.streams
    SET has_rgb_effect = TRUE,
        rgb_purchased = TRUE
    WHERE id = p_stream_id;
    
    -- Log to Purchase Ledger (CRITICAL SYNC)
    SELECT id INTO v_ledger_item_id FROM public.purchasable_items WHERE item_key = 'stream-rgb';
    
    IF v_ledger_item_id IS NOT NULL THEN
        INSERT INTO public.purchase_ledger (
            user_id, item_id, coin_amount, payment_method, source_context, created_at
        ) VALUES (
            v_user_id, v_ledger_item_id, v_cost, 'coins', p_stream_id::text, now()
        );
    END IF;

    -- Log Transaction (Legacy)
    INSERT INTO public.coin_transactions (
      user_id,
      amount,
      type,
      metadata
    ) VALUES (
      v_user_id,
      -v_cost,
      'purchase',
      jsonb_build_object('description', 'Purchased RGB Broadcast Box', 'stream_id', p_stream_id)
    );

    RETURN jsonb_build_object('success', true, 'message', 'Purchased and Enabled');
  END IF;
END;
$$;
