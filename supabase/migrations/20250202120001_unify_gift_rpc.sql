-- Unify Gift and Seat Logic with 10% Admin Cut
-- This migration replaces previous versions of spend_coins and join_paid_seat

-- 1. Redefine spend_coins to include 10% admin cut
CREATE OR REPLACE FUNCTION public.spend_coins(
    p_sender_id UUID,
    p_receiver_id UUID,
    p_coin_amount INTEGER,
    p_source VARCHAR(100),
    p_item VARCHAR(255)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sender_balance INTEGER;
    v_host_cut INTEGER;
    v_admin_cut INTEGER;
    v_gift_id UUID;
BEGIN
    -- Get sender balance (locking row)
    SELECT troll_coins INTO v_sender_balance 
    FROM public.user_profiles 
    WHERE id = p_sender_id
    FOR UPDATE;
    
    -- Check balance
    IF COALESCE(v_sender_balance, 0) < p_coin_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
    END IF;
    
    -- Calculate cuts (10% to Admin/Platform, 90% to Recipient)
    v_admin_cut := FLOOR(p_coin_amount * 0.10);
    v_host_cut := p_coin_amount - v_admin_cut;
    
    -- Deduct FULL amount from sender
    UPDATE public.user_profiles 
    SET troll_coins = troll_coins - p_coin_amount,
        updated_at = NOW()
    WHERE id = p_sender_id;
    
    -- Add HOST cut to receiver (if not same as sender - e.g. buying own item?)
    -- Usually gifts are to others. If receiver is same, we just burn the fee? 
    -- Assuming receiver is different.
    IF p_sender_id != p_receiver_id THEN
        UPDATE public.user_profiles 
        SET troll_coins = troll_coins + v_host_cut,
            updated_at = NOW()
        WHERE id = p_receiver_id;
    END IF;
    
    -- Admin cut is implicitly "burned" (removed from circulation) 
    -- or could be added to a specific admin wallet here if required.
    
    -- Create gift record (for history/XP)
    INSERT INTO public.gifts (sender_id, receiver_id, coin_amount, gift_type, gift_slug, source)
    VALUES (p_sender_id, p_receiver_id, p_coin_amount, 'paid', p_item, p_source)
    RETURNING id INTO v_gift_id;
    
    RETURN jsonb_build_object('success', true, 'gift_id', v_gift_id);
END;
$$;

-- 2. Ensure join_paid_seat also has the cut
CREATE OR REPLACE FUNCTION public.join_paid_seat(
  p_stream_id UUID,
  p_seat_index INTEGER DEFAULT 0
) RETURNS BOOLEAN AS $$
DECLARE
  v_stream_record RECORD;
  v_user_id UUID;
  v_user_balance INTEGER;
  v_host_cut INTEGER;
  v_admin_cut INTEGER;
BEGIN
  v_user_id := auth.uid();

  -- Get stream info
  SELECT * INTO v_stream_record FROM public.streams WHERE id = p_stream_id;
  
  IF v_stream_record IS NULL THEN
    RAISE EXCEPTION 'Stream not found';
  END IF;

  IF COALESCE(v_stream_record.seat_price, 0) <= 0 THEN
    RETURN TRUE; -- Free to join
  END IF;

  -- Check user balance
  SELECT troll_coins INTO v_user_balance FROM public.user_profiles WHERE id = v_user_id;
  
  IF COALESCE(v_user_balance, 0) < v_stream_record.seat_price THEN
    RAISE EXCEPTION 'Insufficient funds to join seat';
  END IF;

  -- Calculate cuts
  v_admin_cut := FLOOR(v_stream_record.seat_price * 0.10);
  v_host_cut := v_stream_record.seat_price - v_admin_cut;

  -- Deduct from joiner
  UPDATE public.user_profiles 
  SET troll_coins = troll_coins - v_stream_record.seat_price
  WHERE id = v_user_id;

  -- Add to Host
  UPDATE public.user_profiles 
  SET troll_coins = troll_coins + v_host_cut 
  WHERE id = v_stream_record.user_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
