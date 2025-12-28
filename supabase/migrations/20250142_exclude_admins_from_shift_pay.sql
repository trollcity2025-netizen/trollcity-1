-- Exclude admins from shift scheduling payroll
-- Admins can access officer features but don't get paid for shifts

-- Update clock_in_from_slot to prevent admins from clocking in
CREATE OR REPLACE FUNCTION clock_in_from_slot(p_slot_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_slot RECORD;
  v_officer RECORD;
  v_log_id UUID;
BEGIN
  -- Get slot and officer info
  SELECT s.*, up.role, up.is_admin INTO v_slot, v_officer
  FROM officer_shift_slots s
  JOIN user_profiles up ON up.id = s.officer_id
  WHERE s.id = p_slot_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Shift slot not found');
  END IF;

  -- Prevent admins from clocking in (they don't get paid)
  IF v_officer.role = 'admin' OR v_officer.is_admin = TRUE THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Admins cannot clock in for shifts. You have full access without needing to work shifts.');
  END IF;

  -- Check if slot is scheduled
  IF v_slot.status != 'scheduled' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Shift slot is not scheduled');
  END IF;

  -- Check if officer already has an active shift
  SELECT id INTO v_log_id
  FROM officer_shift_logs
  WHERE officer_id = v_slot.officer_id AND shift_end IS NULL;

  IF v_log_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'You already have an active shift. Please clock out first.');
  END IF;

  -- Create shift log
  INSERT INTO officer_shift_logs (officer_id, shift_start, last_activity)
  VALUES (v_slot.officer_id, NOW(), NOW())
  RETURNING id INTO v_log_id;

  -- Update slot status
  UPDATE officer_shift_slots
  SET status = 'active', shift_log_id = v_log_id, updated_at = NOW()
  WHERE id = p_slot_id;

  RETURN jsonb_build_object('success', TRUE, 'log_id', v_log_id);
END;
$$;

-- Update clock_out_and_complete_slot to prevent admins from earning coins
CREATE OR REPLACE FUNCTION clock_out_and_complete_slot(p_slot_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_slot RECORD;
  v_officer RECORD;
  v_log RECORD;
  v_hours_worked NUMERIC;
  v_coins_earned INTEGER;
BEGIN
  -- Get slot and officer info
  SELECT s.*, up.role, up.is_admin INTO v_slot, v_officer
  FROM officer_shift_slots s
  JOIN user_profiles up ON up.id = s.officer_id
  WHERE s.id = p_slot_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Shift slot not found');
  END IF;

  -- Prevent admins from clocking out (they don't get paid)
  IF v_officer.role = 'admin' OR v_officer.is_admin = TRUE THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Admins cannot clock out for shifts. You have full access without needing to work shifts.');
  END IF;

  -- Get shift log
  SELECT * INTO v_log
  FROM officer_shift_logs
  WHERE id = v_slot.shift_log_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Shift log not found');
  END IF;

  -- Calculate hours worked
  v_hours_worked := EXTRACT(EPOCH FROM (NOW() - v_log.shift_start)) / 3600.0;

  -- Calculate coins (100 coins per hour, minimum 1 hour)
  v_coins_earned := GREATEST(100, FLOOR(v_hours_worked * 100));

  -- Update shift log
  UPDATE officer_shift_logs
  SET 
    shift_end = NOW(),
    hours_worked = v_hours_worked,
    coins_earned = v_coins_earned,
    updated_at = NOW()
  WHERE id = v_log.id;

  -- Credit coins to officer (only for non-admins)
  UPDATE user_profiles
  SET 
    free_coin_balance = COALESCE(free_coin_balance, 0) + v_coins_earned,
    updated_at = NOW()
  WHERE id = v_slot.officer_id;

  -- Update slot status
  UPDATE officer_shift_slots
  SET 
    status = 'completed',
    coins_earned = v_coins_earned,
    hours_worked = v_hours_worked,
    updated_at = NOW()
  WHERE id = p_slot_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'hours_worked', v_hours_worked,
    'coins_earned', v_coins_earned
  );
END;
$$;

COMMENT ON FUNCTION clock_in_from_slot IS 'Clocks in an officer for a shift (excludes admins)';
COMMENT ON FUNCTION clock_out_and_complete_slot IS 'Clocks out an officer and awards coins (excludes admins)';

