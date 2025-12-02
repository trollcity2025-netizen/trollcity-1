-- RPC function for admins to end shifts
CREATE OR REPLACE FUNCTION admin_end_shift(
  p_shift_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_shift RECORD;
  v_hours_worked NUMERIC;
  v_coins_earned INTEGER;
BEGIN
  -- Get shift details
  SELECT * INTO v_shift
  FROM officer_shift_logs
  WHERE id = p_shift_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Shift not found');
  END IF;

  -- Check if shift is already ended
  IF v_shift.clock_out IS NOT NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Shift already ended');
  END IF;

  -- Calculate hours worked
  v_hours_worked := EXTRACT(EPOCH FROM (NOW() - v_shift.clock_in)) / 3600.0;

  -- Calculate coins (100 coins per hour, minimum 1 hour)
  v_coins_earned := GREATEST(100, FLOOR(v_hours_worked * 100));

  -- Update shift log
  UPDATE officer_shift_logs
  SET 
    clock_out = NOW(),
    hours_worked = v_hours_worked,
    coins_earned = v_coins_earned,
    auto_clocked_out = TRUE, -- Mark as admin-ended
    updated_at = NOW()
  WHERE id = p_shift_id;

  -- Credit coins to officer
  UPDATE user_profiles
  SET 
    free_coin_balance = COALESCE(free_coin_balance, 0) + v_coins_earned,
    updated_at = NOW()
  WHERE id = v_shift.officer_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'hours_worked', v_hours_worked,
    'coins_earned', v_coins_earned,
    'message', 'Shift ended successfully'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_end_shift(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION admin_end_shift IS 'Allows admins to end officer shifts and calculate earnings';

