-- Create function to handle cashout with 24-hour wait limit and level 40+ instant access
CREATE OR REPLACE FUNCTION create_cashout_request(
  p_user_id UUID,
  p_amount NUMERIC,
  p_payment_method TEXT,
  p_payment_details JSONB DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  cashout_id UUID,
  wait_hours INTEGER
) AS $$
DECLARE
  v_user_level INTEGER;
  v_user_coins NUMERIC;
  v_last_cashout TIMESTAMP WITH TIME ZONE;
  v_hours_since_last_cashout INTEGER;
  v_can_instant_cashout BOOLEAN;
  v_cashout_id UUID;
BEGIN
  -- Get user level and coin balance
  SELECT level, coins INTO v_user_level, v_user_coins
  FROM profiles 
  WHERE id = p_user_id;

  IF v_user_coins IS NULL OR v_user_coins < p_amount THEN
    RETURN QUERY SELECT false, 'Insufficient coins for cashout', NULL, 0;
    RETURN;
  END IF;

  -- Check for recent cashouts
  SELECT MAX(created_at) INTO v_last_cashout
  FROM cashout_requests 
  WHERE user_id = p_user_id 
    AND status IN ('pending', 'approved', 'completed')
    AND created_at >= NOW() - INTERVAL '24 hours';

  -- Calculate hours since last cashout
  IF v_last_cashout IS NOT NULL THEN
    v_hours_since_last_cashout := EXTRACT(HOUR FROM (NOW() - v_last_cashout));
  ELSE
    v_hours_since_last_cashout := 25; -- More than 24 hours
  END IF;

  -- Check if user can do instant cashout (level 40+)
  v_can_instant_cashout := (v_user_level >= 40);

  -- Check 24-hour wait limit (unless level 40+)
  IF v_hours_since_last_cashout < 24 AND NOT v_can_instant_cashout THEN
    RETURN QUERY SELECT 
      false, 
      'You must wait 24 hours between cashouts. Level 40+ users get instant cashout.',
      NULL,
      (24 - v_hours_since_last_cashout);
    RETURN;
  END IF;

  -- Create the cashout request
  v_cashout_id := gen_random_uuid();
  
  INSERT INTO cashout_requests (
    id,
    user_id,
    amount,
    status,
    payment_method,
    payment_details,
    coins_cost,
    requested_at,
    created_at
  ) VALUES (
    v_cashout_id,
    p_user_id,
    p_amount,
    'pending',
    p_payment_method,
    p_payment_details,
    p_amount, -- coins_cost equals cashout amount
    NOW(),
    NOW()
  );

  -- Debit coins from user balance
  UPDATE profiles 
  SET coins = coins - p_amount,
      purchased_coins = purchased_coins - p_amount
  WHERE id = p_user_id;

  RETURN QUERY SELECT 
    true, 
    CASE 
      WHEN v_can_instant_cashout THEN 'Instant cashout request created successfully!'
      ELSE 'Cashout request created. Processing will begin shortly.'
    END,
    v_cashout_id,
    0;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;