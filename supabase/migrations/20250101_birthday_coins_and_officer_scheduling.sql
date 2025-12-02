-- Birthday coins reward and officer scheduling system

-- Add birthday_coins_awarded flag to track if user already received birthday coins today
ALTER TABLE user_profiles 
  ADD COLUMN IF NOT EXISTS birthday_coins_awarded_date DATE;

-- Create index for birthday checks
CREATE INDEX IF NOT EXISTS idx_user_profiles_birthday_coins 
  ON user_profiles(birthday_coins_awarded_date) 
  WHERE birthday_coins_awarded_date IS NOT NULL;

-- Function to award birthday coins when user goes live
CREATE OR REPLACE FUNCTION award_birthday_coins_if_eligible(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date_of_birth DATE;
  v_today DATE;
  v_birthday_month INT;
  v_birthday_day INT;
  v_today_month INT;
  v_today_day INT;
  v_already_awarded DATE;
  v_birthday_coins INTEGER := 1000;
BEGIN
  -- Get user's date of birth
  SELECT date_of_birth, birthday_coins_awarded_date
  INTO v_date_of_birth, v_already_awarded
  FROM user_profiles
  WHERE id = p_user_id;

  -- If no date of birth, return early
  IF v_date_of_birth IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_birthday_set');
  END IF;

  -- Get today's date
  v_today := CURRENT_DATE;
  v_today_month := EXTRACT(MONTH FROM v_today);
  v_today_day := EXTRACT(DAY FROM v_today);

  -- Extract month and day from birthday
  v_birthday_month := EXTRACT(MONTH FROM v_date_of_birth);
  v_birthday_day := EXTRACT(DAY FROM v_date_of_birth);

  -- Check if today is their birthday
  IF v_today_month != v_birthday_month OR v_today_day != v_birthday_day THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_birthday');
  END IF;

  -- Check if already awarded today
  IF v_already_awarded = v_today THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_awarded');
  END IF;

  -- Award 1000 paid coins
  UPDATE user_profiles
  SET 
    paid_coin_balance = COALESCE(paid_coin_balance, 0) + v_birthday_coins,
    total_earned_coins = COALESCE(total_earned_coins, 0) + v_birthday_coins,
    birthday_coins_awarded_date = v_today,
    updated_at = NOW()
  WHERE id = p_user_id;

  -- Record transaction
  INSERT INTO coin_transactions (
    user_id,
    type,
    amount,
    description,
    metadata,
    created_at
  ) VALUES (
    p_user_id,
    'birthday_bonus',
    v_birthday_coins,
    'Birthday bonus - 1000 paid coins',
    jsonb_build_object('birthday_date', v_date_of_birth, 'awarded_date', v_today),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'coins_awarded', v_birthday_coins,
    'message', 'Happy Birthday! You received 1000 paid coins!'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION award_birthday_coins_if_eligible(UUID) TO authenticated;

-- Officer scheduling system
CREATE TABLE IF NOT EXISTS officer_shift_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  shift_start_time TIME NOT NULL,
  shift_end_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(officer_id, shift_date, shift_start_time)
);

CREATE INDEX IF NOT EXISTS idx_officer_shift_slots_officer ON officer_shift_slots(officer_id);
CREATE INDEX IF NOT EXISTS idx_officer_shift_slots_date ON officer_shift_slots(shift_date);
CREATE INDEX IF NOT EXISTS idx_officer_shift_slots_status ON officer_shift_slots(status);

-- Enable RLS
ALTER TABLE officer_shift_slots ENABLE ROW LEVEL SECURITY;

-- Officers can view their own slots
CREATE POLICY "Officers can view own shift slots"
  ON officer_shift_slots FOR SELECT
  USING (
    officer_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'troll_officer')
    )
  );

-- Officers can insert their own slots
CREATE POLICY "Officers can insert own shift slots"
  ON officer_shift_slots FOR INSERT
  WITH CHECK (
    officer_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND (role = 'troll_officer' OR is_troll_officer = true)
    )
  );

-- Officers can update their own slots
CREATE POLICY "Officers can update own shift slots"
  ON officer_shift_slots FOR UPDATE
  USING (
    officer_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Officers can delete their own slots (if not active)
CREATE POLICY "Officers can delete own shift slots"
  ON officer_shift_slots FOR DELETE
  USING (
    (officer_id = auth.uid() AND status != 'active') OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Function to clock in from scheduled slot
CREATE OR REPLACE FUNCTION clock_in_from_slot(
  p_slot_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot RECORD;
  v_officer_id UUID;
  v_shift_start TIMESTAMPTZ;
BEGIN
  -- Get slot details
  SELECT * INTO v_slot
  FROM officer_shift_slots
  WHERE id = p_slot_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Shift slot not found');
  END IF;

  -- Verify officer
  v_officer_id := auth.uid();
  IF v_slot.officer_id != v_officer_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Check if slot is in the past
  IF (v_slot.shift_date || ' ' || v_slot.shift_start_time)::TIMESTAMPTZ < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot clock in to past shift');
  END IF;

  -- Check if already has active shift
  IF EXISTS (
    SELECT 1 FROM officer_shift_logs
    WHERE officer_id = v_officer_id AND shift_end IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have an active shift');
  END IF;

  -- Create shift log entry
  v_shift_start := (v_slot.shift_date || ' ' || v_slot.shift_start_time)::TIMESTAMPTZ;
  
  INSERT INTO officer_shift_logs (
    officer_id,
    shift_start,
    last_activity
  ) VALUES (
    v_officer_id,
    v_shift_start,
    NOW()
  );

  -- Update slot status to active
  UPDATE officer_shift_slots
  SET status = 'active', updated_at = NOW()
  WHERE id = p_slot_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Clocked in successfully',
    'shift_start', v_shift_start
  );
END;
$$;

GRANT EXECUTE ON FUNCTION clock_in_from_slot(UUID) TO authenticated;

-- Function to clock out and complete slot
CREATE OR REPLACE FUNCTION clock_out_and_complete_slot(
  p_slot_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot RECORD;
  v_shift_log RECORD;
  v_hours_worked NUMERIC;
  v_coins_earned INTEGER;
BEGIN
  -- Get slot details
  SELECT * INTO v_slot
  FROM officer_shift_slots
  WHERE id = p_slot_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Shift slot not found');
  END IF;

  -- Verify officer
  IF v_slot.officer_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Find active shift log
  SELECT * INTO v_shift_log
  FROM officer_shift_logs
  WHERE officer_id = v_slot.officer_id
    AND shift_end IS NULL
  ORDER BY shift_start DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active shift found');
  END IF;

  -- Calculate hours worked
  v_hours_worked := EXTRACT(EPOCH FROM (NOW() - v_shift_log.shift_start)) / 3600.0;
  v_coins_earned := FLOOR(v_hours_worked * 10000000); -- 10 million coins per hour

  -- Update shift log
  UPDATE officer_shift_logs
  SET 
    shift_end = NOW(),
    hours_worked = v_hours_worked,
    coins_earned = v_coins_earned,
    updated_at = NOW()
  WHERE id = v_shift_log.id;

  -- Update slot status to completed
  UPDATE officer_shift_slots
  SET status = 'completed', updated_at = NOW()
  WHERE id = p_slot_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Clocked out successfully',
    'hours_worked', v_hours_worked,
    'coins_earned', v_coins_earned
  );
END;
$$;

GRANT EXECUTE ON FUNCTION clock_out_and_complete_slot(UUID) TO authenticated;

COMMENT ON TABLE officer_shift_slots IS 'Officers schedule their work shifts in advance. Each slot must be filled by the assigned officer.';
COMMENT ON FUNCTION award_birthday_coins_if_eligible(UUID) IS 'Awards 1000 paid coins to user when they go live on their birthday (once per day)';

