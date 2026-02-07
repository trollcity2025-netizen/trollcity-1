-- Migration to add purchase_rgb_broadcast RPC and support column

-- 1. Add tracking column
ALTER TABLE public.streams 
ADD COLUMN IF NOT EXISTS rgb_purchased BOOLEAN DEFAULT FALSE;

-- 2. Create/Replace RPC
DO $$ 
DECLARE 
    r RECORD; 
BEGIN 
    FOR r IN SELECT oid::regprocedure AS func_signature 
             FROM pg_proc 
             WHERE proname = 'purchase_rgb_broadcast' 
             AND pronamespace = 'public'::regnamespace 
    LOOP 
        EXECUTE 'DROP FUNCTION ' || r.func_signature; 
    END LOOP; 
END $$;

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
    
    -- Log Transaction
    INSERT INTO public.coin_transactions (
      user_id,
      amount,
      transaction_type,
      description,
      metadata
    ) VALUES (
      v_user_id,
      -v_cost,
      'spend',
      'Purchased RGB Broadcast Box',
      jsonb_build_object('stream_id', p_stream_id)
    );

    RETURN jsonb_build_object('success', true, 'message', 'Purchased and Enabled');
  END IF;
END;
$$;
