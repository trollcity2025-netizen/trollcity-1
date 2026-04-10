-- COMPREHENSIVE FIXES FOR HEAVY LOAD TESTING
-- 1. Fix join_stream_box (Credit Broadcaster)
-- 2. Fix send_gift_in_stream (Add metadata param)
-- 3. Add set_stream_box_count
-- 4. Fix assign_broadofficer (Standardize on broadcast_officers)
-- 5. Add purchase_rgb_broadcast

-- ==========================================
-- 1. Fix join_stream_box
-- ==========================================
DROP FUNCTION IF EXISTS public.join_stream_box(UUID, UUID);

CREATE OR REPLACE FUNCTION public.join_stream_box(
  p_stream_id UUID,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stream RECORD;
  v_user_balance INT;
  v_box_price INT;
  v_price_type TEXT;
  v_broadcaster_id UUID;
BEGIN
  -- Get stream details
  SELECT * INTO v_stream FROM public.streams WHERE id = p_stream_id;
  IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Stream not found'); END IF;

  v_box_price := COALESCE(v_stream.box_price_amount, 0);
  v_price_type := COALESCE(v_stream.box_price_type, 'per_minute');
  v_broadcaster_id := v_stream.user_id; -- Assuming user_id is the broadcaster

  -- Check user balance
  SELECT troll_coins INTO v_user_balance FROM public.user_profiles WHERE id = p_user_id;
  
  IF v_user_balance < v_box_price THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient coins to join box');
  END IF;

  -- If flat fee, charge immediately and CREDIT BROADCASTER
  IF v_box_price > 0 AND v_price_type = 'flat' THEN
    -- Deduct from Guest
    UPDATE public.user_profiles 
    SET troll_coins = troll_coins - v_box_price,
        total_spent_coins = COALESCE(total_spent_coins, 0) + v_box_price
    WHERE id = p_user_id;

    -- Credit Broadcaster (Instant Transfer)
    UPDATE public.user_profiles
    SET troll_coins = troll_coins + v_box_price
    WHERE id = v_broadcaster_id;

    -- Transaction Logs
    INSERT INTO public.coin_transactions (user_id, amount, type, description, metadata)
    VALUES 
    (p_user_id, -v_box_price, 'guest_box_fee', 'Joined Guest Box (Flat Fee)', json_build_object('stream_id', p_stream_id, 'recipient', v_broadcaster_id)),
    (v_broadcaster_id, v_box_price, 'guest_box_income', 'Guest Joined Box', json_build_object('stream_id', p_stream_id, 'sender', p_user_id));
  END IF;

  -- Add to stream_guests
  INSERT INTO public.stream_guests (stream_id, user_id, status, last_billed_at)
  VALUES (p_stream_id, p_user_id, 'active', NOW())
  ON CONFLICT (stream_id, user_id) 
  DO UPDATE SET status = 'active', joined_at = NOW(), last_billed_at = NOW();

  RETURN json_build_object('success', true);
END;
$$;

-- ==========================================
-- 2. Fix send_gift_in_stream (Add metadata)
-- ==========================================
DROP FUNCTION IF EXISTS public.send_gift_in_stream(UUID, UUID, UUID, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.send_gift_in_stream(
  p_sender_id UUID,
  p_receiver_id UUID,
  p_stream_id UUID,
  p_gift_id TEXT,
  p_quantity INTEGER,
  p_metadata JSONB DEFAULT '{}'::jsonb
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
  v_merged_metadata JSONB;
BEGIN
  -- 1. Get gift cost and name
  SELECT cost, name INTO v_gift_cost, v_gift_name
  FROM public.gifts
  WHERE id::text = p_gift_id OR slug = p_gift_id;

  IF v_gift_cost IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Gift not found');
  END IF;

  v_total_cost := v_gift_cost * p_quantity;

  -- 2. Check sender's balance
  SELECT troll_coins INTO v_sender_balance FROM public.user_profiles WHERE id = p_sender_id;
  IF v_sender_balance < v_total_cost THEN
    RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
  END IF;

  -- 3. Deduct cost from sender
  UPDATE public.user_profiles
  SET troll_coins = troll_coins - v_total_cost
  WHERE id = p_sender_id;

  -- 4. Credit receiver (95% share)
  UPDATE public.user_profiles
  SET troll_coins = troll_coins + FLOOR(v_total_cost * 0.95)
  WHERE id = p_receiver_id;

  -- 5. Record transaction
  v_merged_metadata := p_metadata || jsonb_build_object('gift_id', p_gift_id, 'stream_id', p_stream_id, 'quantity', p_quantity);
  
  INSERT INTO coin_transactions (user_id, amount, type, metadata)
  VALUES
    (p_sender_id, -v_total_cost, 'gift_sent', v_merged_metadata || jsonb_build_object('receiver_id', p_receiver_id)),
    (p_receiver_id, FLOOR(v_total_cost * 0.95), 'gift_received', v_merged_metadata || jsonb_build_object('sender_id', p_sender_id));

  -- 6. Insert message into stream
  INSERT INTO stream_messages (stream_id, user_id, content)
  VALUES (p_stream_id, p_sender_id, 'GIFT_EVENT:' || v_gift_name || ':' || p_quantity);

  -- 7. Battle Scoring Logic
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

  RETURN jsonb_build_object('success', true, 'message', 'Gift sent successfully');
END;
$$;

-- ==========================================
-- 3. Add set_stream_box_count
-- ==========================================
DROP FUNCTION IF EXISTS public.set_stream_box_count(UUID, INTEGER);

CREATE OR REPLACE FUNCTION public.set_stream_box_count(
    p_stream_id UUID,
    p_count INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.streams
    SET box_count = p_count
    WHERE id = p_stream_id;
END;
$$;

-- ==========================================
-- 4. Fix assign_broadofficer
-- ==========================================
-- Standardize on broadcast_officers table
CREATE TABLE IF NOT EXISTS public.broadcast_officers (
    broadcaster_id UUID REFERENCES auth.users(id),
    officer_id UUID REFERENCES auth.users(id),
    stream_id UUID REFERENCES public.streams(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (broadcaster_id, officer_id, stream_id)
);

-- Add index for stream_id lookups
CREATE INDEX IF NOT EXISTS idx_broadcast_officers_stream ON public.broadcast_officers(stream_id);

CREATE OR REPLACE FUNCTION public.assign_broadofficer(
    p_user_id UUID, -- The officer to assign
    p_stream_id UUID DEFAULT NULL -- Optional stream_id for stream-specific officers
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_broadcaster_id UUID;
BEGIN
    v_broadcaster_id := auth.uid();
    
    INSERT INTO public.broadcast_officers (broadcaster_id, officer_id, stream_id)
    VALUES (v_broadcaster_id, p_user_id, p_stream_id)
    ON CONFLICT (broadcaster_id, officer_id, stream_id) DO NOTHING;
END;
$$;

-- ==========================================
-- 5. Add purchase_rgb_broadcast
-- ==========================================
-- Add is_broadcast_officer function
CREATE OR REPLACE FUNCTION public.is_broadcast_officer(
    p_user_id UUID,
    p_stream_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_result BOOLEAN := FALSE;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.broadcast_officers
        WHERE officer_id = p_user_id 
        AND (stream_id = p_stream_id OR stream_id IS NULL)
        AND broadcaster_id = (SELECT user_id FROM public.streams WHERE id = p_stream_id)
    ) INTO v_result;
    
    RETURN v_result;
END;
$$;
DROP FUNCTION IF EXISTS public.purchase_rgb_broadcast(UUID, BOOLEAN);
CREATE OR REPLACE FUNCTION public.purchase_rgb_broadcast(
    p_stream_id UUID,
    p_enable BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cost INTEGER := 500; -- Example cost
    v_user_id UUID;
    v_balance INTEGER;
BEGIN
    v_user_id := auth.uid();
    
    -- Check balance if enabling and not already purchased (logic simplification)
    -- For now, just deduct if enabling
    IF p_enable THEN
        SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = v_user_id;
        IF v_balance < v_cost THEN
            RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds');
        END IF;

        UPDATE public.user_profiles
        SET troll_coins = troll_coins - v_cost
        WHERE id = v_user_id;
    END IF;

    UPDATE public.streams
    SET has_rgb_effect = p_enable,
        rgb_purchased = true
    WHERE id = p_stream_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- ==========================================
-- 6. Ensure Pod Rooms Table
-- ==========================================
CREATE TABLE IF NOT EXISTS public.pod_rooms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    host_id UUID REFERENCES auth.users(id),
    title TEXT,
    is_live BOOLEAN DEFAULT false,
    viewer_count INTEGER DEFAULT 0,
    guest_price INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for Pod Rooms if not already
ALTER TABLE public.pod_rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public View Pods" ON public.pod_rooms;
CREATE POLICY "Public View Pods" ON public.pod_rooms FOR SELECT USING (true);
DROP POLICY IF EXISTS "Host Manage Pods" ON public.pod_rooms;
CREATE POLICY "Host Manage Pods" ON public.pod_rooms FOR ALL USING (auth.uid() = host_id);
