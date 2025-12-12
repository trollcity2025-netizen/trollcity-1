-- Lucky Trollmonds System
-- Created: 2025-12-12
-- Purpose: Implement gambling-like mechanics for gifting with Trollmonds rewards

-- 1. Add currency columns to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS paid_coins bigint NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS trollmonds bigint NOT NULL DEFAULT 0;

-- 2. Create lucky_trollmond_events audit table
CREATE TABLE IF NOT EXISTS lucky_trollmond_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  gift_id uuid, -- Can be null for future expansion
  spent_paid_coins bigint NOT NULL CHECK (spent_paid_coins > 0),
  multiplier integer CHECK (multiplier IN (100, 200, 500, 1000, 10000)),
  trollmonds_awarded bigint NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_lucky_trollmond_events_user_id ON lucky_trollmond_events(user_id);
CREATE INDEX IF NOT EXISTS idx_lucky_trollmond_events_created_at ON lucky_trollmond_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lucky_trollmond_events_multiplier ON lucky_trollmond_events(multiplier) WHERE multiplier IS NOT NULL;

-- 4. Enable RLS
ALTER TABLE lucky_trollmond_events ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
CREATE POLICY "Users can view their own lucky events"
  ON lucky_trollmond_events FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all lucky events"
  ON lucky_trollmond_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 6. Function to process lucky roll (server-side only)
CREATE OR REPLACE FUNCTION calculate_lucky_multiplier(spent_coins bigint)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_roll real;
  scale real := 1.0;
  result integer := NULL;
BEGIN
  -- Input validation
  IF spent_coins <= 0 THEN
    RETURN NULL;
  END IF;

  -- Apply scaling based on gift cost
  IF spent_coins > 2500 THEN
    scale := 0.25;
  ELSIF spent_coins > 500 THEN
    scale := 0.6;
  END IF;

  -- Generate random roll (0-100)
  base_roll := random() * 100;

  -- Check against scaled probabilities
  IF base_roll < (0.01 * scale) THEN
    result := 10000;  -- 0.01% base → 0.0025% scaled for high spenders
  ELSIF base_roll < (0.26 * scale) THEN
    result := 1000;   -- 0.25% base → 0.065% scaled for high spenders
  ELSIF base_roll < (1.26 * scale) THEN
    result := 500;    -- 1.0% base → 0.25% scaled for high spenders
  ELSIF base_roll < (3.76 * scale) THEN
    result := 200;    -- 2.5% base → 0.625% scaled for high spenders
  ELSIF base_roll < (9.76 * scale) THEN
    result := 100;    -- 6.0% base → 1.5% scaled for high spenders
  END IF;

  RETURN result;
END;
$$;

-- 7. Function to process gift with lucky mechanics (atomic transaction)
CREATE OR REPLACE FUNCTION process_gift_with_lucky(
  p_sender_id uuid,
  p_receiver_id uuid,
  p_paid_coins bigint,
  p_gift_type varchar DEFAULT 'standard'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_balance bigint;
  v_lucky_multiplier integer;
  v_trollmonds_awarded bigint := 0;
  v_event_id uuid;
  v_admin_check boolean := false;
BEGIN
  -- Input validation
  IF p_paid_coins <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid coin amount');
  END IF;

  IF p_sender_id = p_receiver_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot send gift to yourself');
  END IF;

  -- Check if receiver is admin (for royal family processing)
  SELECT EXISTS(
    SELECT 1 FROM user_profiles
    WHERE id = p_receiver_id AND role = 'admin'
  ) INTO v_admin_check;

  -- Check sender balance
  SELECT paid_coins INTO v_sender_balance
  FROM user_profiles
  WHERE id = p_sender_id;

  IF v_sender_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sender not found');
  END IF;

  IF v_sender_balance < p_paid_coins THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient paid coins');
  END IF;

  -- Start atomic transaction
  BEGIN
    -- Deduct paid coins from sender
    UPDATE user_profiles
    SET paid_coins = paid_coins - p_paid_coins,
        updated_at = now()
    WHERE id = p_sender_id;

    -- Process gift and update recipient's earned coins for payout system
    UPDATE user_profiles
    SET total_earned_coins = total_earned_coins + p_paid_coins,
        updated_at = now()
    WHERE id = p_receiver_id;

    -- Roll for lucky multiplier
    SELECT calculate_lucky_multiplier(p_paid_coins) INTO v_lucky_multiplier;

    -- Calculate trollmonds if lucky
    IF v_lucky_multiplier IS NOT NULL THEN
      v_trollmonds_awarded := p_paid_coins * v_lucky_multiplier;

      -- Credit trollmonds to sender
      UPDATE user_profiles
      SET trollmonds = trollmonds + v_trollmonds_awarded,
          updated_at = now()
      WHERE id = p_sender_id;
    END IF;

    -- Log the lucky event (always, even if no win)
    INSERT INTO lucky_trollmond_events (
      user_id,
      gift_id,
      spent_paid_coins,
      multiplier,
      trollmonds_awarded
    ) VALUES (
      p_sender_id,
      gen_random_uuid(), -- Generate gift ID
      p_paid_coins,
      v_lucky_multiplier,
      v_trollmonds_awarded
    ) RETURNING id INTO v_event_id;

    -- Process admin gift for royal family if receiver is admin
    IF v_admin_check THEN
      PERFORM process_admin_gift(p_sender_id, p_receiver_id, p_paid_coins);
    END IF;

    -- Commit transaction
    RETURN jsonb_build_object(
      'success', true,
      'spent_coins', p_paid_coins,
      'lucky_multiplier', v_lucky_multiplier,
      'trollmonds_awarded', v_trollmonds_awarded,
      'new_paid_balance', v_sender_balance - p_paid_coins,
      'event_id', v_event_id
    );

  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback on any error
      RETURN jsonb_build_object('success', false, 'error', SQLERRM);
  END;
END;
$$;

-- 8. Function to get user's lucky statistics
CREATE OR REPLACE FUNCTION get_lucky_stats(p_user_id uuid DEFAULT NULL)
RETURNS TABLE (
  total_spent bigint,
  total_trollmonds_won bigint,
  total_wins bigint,
  win_rate real,
  biggest_win bigint,
  last_win_at timestamptz,
  multiplier_counts jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    p_user_id := auth.uid();
  END IF;

  -- Check permissions (users can view their own, admins can view anyone's)
  IF p_user_id != auth.uid() THEN
    IF NOT EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Access denied';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(SUM(spent_paid_coins), 0)::bigint as total_spent,
    COALESCE(SUM(trollmonds_awarded), 0)::bigint as total_trollmonds_won,
    COUNT(*) FILTER (WHERE multiplier IS NOT NULL)::bigint as total_wins,
    CASE
      WHEN COUNT(*) > 0 THEN (COUNT(*) FILTER (WHERE multiplier IS NOT NULL)::real / COUNT(*)::real) * 100
      ELSE 0
    END as win_rate,
    COALESCE(MAX(trollmonds_awarded), 0)::bigint as biggest_win,
    MAX(created_at) FILTER (WHERE multiplier IS NOT NULL) as last_win_at,
    jsonb_build_object(
      'x100', COUNT(*) FILTER (WHERE multiplier = 100),
      'x200', COUNT(*) FILTER (WHERE multiplier = 200),
      'x500', COUNT(*) FILTER (WHERE multiplier = 500),
      'x1000', COUNT(*) FILTER (WHERE multiplier = 1000),
      'x10000', COUNT(*) FILTER (WHERE multiplier = 10000)
    ) as multiplier_counts
  FROM lucky_trollmond_events
  WHERE user_id = p_user_id;
END;
$$;

-- 9. Grant permissions
GRANT EXECUTE ON FUNCTION calculate_lucky_multiplier(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION process_gift_with_lucky(uuid, uuid, bigint, varchar) TO authenticated;
GRANT EXECUTE ON FUNCTION get_lucky_stats(uuid) TO authenticated;

GRANT SELECT ON lucky_trollmond_events TO authenticated;

-- 10. Add comments
COMMENT ON TABLE user_profiles IS 'User profiles with paid_coins and trollmonds balances';
COMMENT ON TABLE lucky_trollmond_events IS 'Audit trail for lucky trollmond events';
COMMENT ON FUNCTION calculate_lucky_multiplier IS 'Calculates lucky multiplier based on spent coins with scaling';
COMMENT ON FUNCTION process_gift_with_lucky IS 'Atomic gift processing with lucky mechanics';
COMMENT ON FUNCTION get_lucky_stats IS 'Returns user lucky statistics and win rates';

-- 11. Create view for recent lucky wins (for live feed)
CREATE OR REPLACE VIEW recent_lucky_wins AS
SELECT
  lte.*,
  up.username,
  up.avatar_url
FROM lucky_trollmond_events lte
LEFT JOIN user_profiles up ON lte.user_id = up.id
WHERE lte.multiplier IS NOT NULL
ORDER BY lte.created_at DESC
LIMIT 50;

GRANT SELECT ON recent_lucky_wins TO authenticated;