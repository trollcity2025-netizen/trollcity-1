-- Kick and Ban System
-- Implements kick system with re-entry fees and auto-ban after 3 kicks

-- Add kick tracking fields to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS kick_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_kicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_kicked boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS kicked_until timestamptz,
  ADD COLUMN IF NOT EXISTS account_deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS account_deletion_cooldown_until timestamptz,
  ADD COLUMN IF NOT EXISTS account_reset_after_ban boolean DEFAULT false;

-- Create kick_logs table
CREATE TABLE IF NOT EXISTS kick_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kicked_user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  kicked_by_user_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  stream_id uuid REFERENCES streams(id) ON DELETE SET NULL,
  kick_cost_paid integer DEFAULT 500, -- coins deducted from kicker
  re_entry_fee_paid integer DEFAULT 0, -- coins paid by kicked user to re-enter
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kick_logs_kicked_user ON kick_logs(kicked_user_id);
CREATE INDEX IF NOT EXISTS idx_kick_logs_kicked_by ON kick_logs(kicked_by_user_id);

-- Enable RLS
ALTER TABLE kick_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own kick logs"
  ON kick_logs FOR SELECT
  TO authenticated
  USING (kicked_user_id = auth.uid() OR kicked_by_user_id = auth.uid());

CREATE POLICY "Admins and officers can view all kick logs"
  ON kick_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND (is_admin = true OR is_troll_officer = true)
    )
  );

-- RPC Function: Kick a user
CREATE OR REPLACE FUNCTION kick_user(
  p_target_user_id uuid,
  p_kicker_user_id uuid,
  p_stream_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_kicker_balance integer;
  v_kick_cost integer := 500;
  v_target_kick_count integer;
  v_result jsonb;
BEGIN
  -- Check if kicker has enough paid coins
  SELECT paid_coin_balance INTO v_kicker_balance
  FROM user_profiles
  WHERE id = p_kicker_user_id;

  IF v_kicker_balance < v_kick_cost THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient paid coins. Need 500 paid coins to kick a user.'
    );
  END IF;

  -- Deduct coins from kicker
  UPDATE user_profiles
  SET paid_coin_balance = paid_coin_balance - v_kick_cost
  WHERE id = p_kicker_user_id;

  -- Get current kick count
  SELECT COALESCE(kick_count, 0) INTO v_target_kick_count
  FROM user_profiles
  WHERE id = p_target_user_id;

  -- Update target user's kick status
  UPDATE user_profiles
  SET 
    kick_count = v_target_kick_count + 1,
    last_kicked_at = now(),
    is_kicked = true,
    kicked_until = now() + interval '1 hour' -- Kicked for 1 hour, can pay to re-enter
  WHERE id = p_target_user_id;

  -- Log the kick
  INSERT INTO kick_logs (kicked_user_id, kicked_by_user_id, stream_id, kick_cost_paid)
  VALUES (p_target_user_id, p_kicker_user_id, p_stream_id, v_kick_cost);

  -- Check if this is the 3rd kick (auto-ban)
  IF v_target_kick_count + 1 >= 3 THEN
    -- Auto-ban user until they pay $20
    UPDATE user_profiles
    SET 
      is_banned = true,
      banned_until = NULL, -- Permanent until payment
      account_reset_after_ban = true
    WHERE id = p_target_user_id;

    RETURN jsonb_build_object(
      'success', true,
      'kicked', true,
      'auto_banned', true,
      'message', 'User kicked and auto-banned. Must pay $20 to restore account.'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'kicked', true,
    'kick_count', v_target_kick_count + 1,
    'message', 'User kicked. They can pay 250 paid coins to re-enter.'
  );
END;
$$;

-- RPC Function: Pay re-entry fee after being kicked
CREATE OR REPLACE FUNCTION pay_kick_reentry_fee(
  p_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_kicked boolean;
  v_user_balance integer;
  v_reentry_fee integer := 250;
  v_kick_count integer;
BEGIN
  -- Check if user is kicked
  SELECT is_kicked, kick_count, paid_coin_balance INTO v_is_kicked, v_kick_count, v_user_balance
  FROM user_profiles
  WHERE id = p_user_id;

  IF NOT v_is_kicked THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User is not currently kicked.'
    );
  END IF;

  -- Check if user has enough paid coins
  IF v_user_balance < v_reentry_fee THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient paid coins. Need 250 paid coins to re-enter.'
    );
  END IF;

  -- Check if user has exceeded max re-entries (3 kicks)
  IF v_kick_count >= 3 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Maximum kicks reached. Account is banned. Pay $20 to restore.'
    );
  END IF;

  -- Deduct re-entry fee
  UPDATE user_profiles
  SET 
    paid_coin_balance = paid_coin_balance - v_reentry_fee,
    is_kicked = false,
    kicked_until = NULL
  WHERE id = p_user_id;

  -- Update kick log
  UPDATE kick_logs
  SET re_entry_fee_paid = v_reentry_fee
  WHERE kicked_user_id = p_user_id
  AND re_entry_fee_paid = 0
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Re-entry fee paid. You can now access the app again.'
  );
END;
$$;

-- RPC Function: Pay ban restoration fee ($20 = 2000 coins)
CREATE OR REPLACE FUNCTION pay_ban_restoration_fee(
  p_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_balance integer;
  v_restoration_fee integer := 2000; -- $20 = 2000 coins
BEGIN
  -- Check if user is banned and needs account reset
  SELECT paid_coin_balance INTO v_user_balance
  FROM user_profiles
  WHERE id = p_user_id
  AND is_banned = true
  AND account_reset_after_ban = true;

  IF v_user_balance IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Account is not eligible for restoration.'
    );
  END IF;

  -- Check if user has enough paid coins
  IF v_user_balance < v_restoration_fee THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient paid coins. Need 2000 paid coins ($20) to restore account.'
    );
  END IF;

  -- Reset account and unban
  UPDATE user_profiles
  SET 
    paid_coin_balance = paid_coin_balance - v_restoration_fee,
    free_coin_balance = 0,
    xp = 0,
    level = 0,
    is_banned = false,
    banned_until = NULL,
    kick_count = 0,
    is_kicked = false,
    kicked_until = NULL,
    account_reset_after_ban = false,
    last_kicked_at = NULL
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Account restored and reset. Fresh start!'
  );
END;
$$;

-- RPC Function: Delete account with cooldown
CREATE OR REPLACE FUNCTION delete_user_account(
  p_user_id uuid,
  p_pay_early_fee boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_early_fee integer := 500; -- $5 = 500 coins
  v_user_balance integer;
  v_cooldown_until timestamptz;
BEGIN
  -- Check if user wants to pay early fee
  IF p_pay_early_fee THEN
    SELECT paid_coin_balance INTO v_user_balance
    FROM user_profiles
    WHERE id = p_user_id;

    IF v_user_balance < v_early_fee THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Insufficient paid coins. Need 500 paid coins ($5) to skip cooldown.'
      );
    END IF;

    -- Deduct fee and allow immediate deletion
    UPDATE user_profiles
    SET 
      paid_coin_balance = paid_coin_balance - v_early_fee,
      account_deleted_at = now()
    WHERE id = p_user_id;

    -- Delete auth user
    -- Note: This requires admin privileges, handled in edge function

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Account deleted. You can create a new account immediately.'
    );
  ELSE
    -- Set 7-day cooldown
    v_cooldown_until := now() + interval '7 days';

    UPDATE user_profiles
    SET 
      account_deleted_at = now(),
      account_deletion_cooldown_until = v_cooldown_until
    WHERE id = p_user_id;

    RETURN jsonb_build_object(
      'success', true,
      'cooldown_until', v_cooldown_until,
      'message', 'Account deletion scheduled. You must wait 7 days before creating a new account, or pay $5 to skip the cooldown.'
    );
  END IF;
END;
$$;

-- Add comment
COMMENT ON TABLE kick_logs IS 'Logs of all kick actions with costs and re-entry fees';
COMMENT ON FUNCTION kick_user IS 'Kicks a user from the app. Costs 500 paid coins. After 3 kicks, user is auto-banned.';
COMMENT ON FUNCTION pay_kick_reentry_fee IS 'Allows kicked user to pay 250 paid coins to re-enter (max 3 times)';
COMMENT ON FUNCTION pay_ban_restoration_fee IS 'Allows banned user to pay $20 (2000 coins) to restore account with reset';
COMMENT ON FUNCTION delete_user_account IS 'Deletes user account with 7-day cooldown or $5 early fee';

