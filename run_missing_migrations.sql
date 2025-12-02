-- Combined Migration File - Run Missing Migrations
-- This file contains the remaining migrations that need to be applied

-- ============================================
-- 0. SCHEDULED ANNOUNCEMENTS TABLE
-- ============================================

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS scheduled_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  is_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Ensure scheduled_time column exists (add if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scheduled_announcements' AND column_name = 'scheduled_time'
  ) THEN
    ALTER TABLE scheduled_announcements 
      ADD COLUMN scheduled_time timestamptz;
    -- Set default for existing rows
    UPDATE scheduled_announcements 
      SET scheduled_time = created_at 
      WHERE scheduled_time IS NULL;
    -- Make it NOT NULL after setting defaults
    ALTER TABLE scheduled_announcements 
      ALTER COLUMN scheduled_time SET NOT NULL;
  END IF;
END $$;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_scheduled_announcements_scheduled_time ON scheduled_announcements(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_scheduled_announcements_is_sent ON scheduled_announcements(is_sent);

-- Enable RLS
ALTER TABLE scheduled_announcements ENABLE ROW LEVEL SECURITY;

-- Only admins can create scheduled announcements
DROP POLICY IF EXISTS "Only admins can create scheduled announcements" ON scheduled_announcements;
CREATE POLICY "Only admins can create scheduled announcements"
  ON scheduled_announcements FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND (is_admin = true OR role = 'admin')
    )
  );

-- Only admins can view scheduled announcements
DROP POLICY IF EXISTS "Only admins can view scheduled announcements" ON scheduled_announcements;
CREATE POLICY "Only admins can view scheduled announcements"
  ON scheduled_announcements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND (is_admin = true OR role = 'admin')
    )
  );

-- Only admins can update scheduled announcements
DROP POLICY IF EXISTS "Only admins can update scheduled announcements" ON scheduled_announcements;
CREATE POLICY "Only admins can update scheduled announcements"
  ON scheduled_announcements FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND (is_admin = true OR role = 'admin')
    )
  );

-- ============================================
-- 1. NOTIFICATIONS SYSTEM
-- ============================================

-- Trollifications - Global Notification System
-- Table for storing all user notifications

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (
    type IN (
      'gift_received',
      'badge_unlocked',
      'payout_status',
      'moderation_action',
      'battle_result',
      'officer_update',
      'system_announcement'
    )
  ),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS notifications_user_id_created_at_idx
  ON notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_user_id_is_read_idx
  ON notifications (user_id, is_read);

CREATE INDEX IF NOT EXISTS notifications_type_idx
  ON notifications (type);

-- RLS Policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- System can insert notifications (via service role or RPC)
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- Function to get unread count
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM notifications
    WHERE user_id = p_user_id
      AND is_read = FALSE
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_unread_notification_count(UUID) TO authenticated;

-- Function to mark all notifications as read
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE notifications
  SET is_read = TRUE
  WHERE user_id = p_user_id
    AND is_read = FALSE;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION mark_all_notifications_read(UUID) TO authenticated;

-- Function to create notification (for use in triggers/RPC)
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO notifications (user_id, type, title, message, metadata)
  VALUES (p_user_id, p_type, p_title, p_message, p_metadata)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_notification(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;

-- ============================================
-- 2. EARNINGS SYSTEM (Views)
-- ============================================

-- Ensure payout_requests table has all required columns
DO $$
BEGIN
  -- Add cash_amount if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payout_requests' AND column_name = 'cash_amount'
  ) THEN
    ALTER TABLE payout_requests 
      ADD COLUMN cash_amount numeric(10,2);
  END IF;

  -- Add coins_redeemed if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payout_requests' AND column_name = 'coins_redeemed'
  ) THEN
    ALTER TABLE payout_requests 
      ADD COLUMN coins_redeemed bigint;
  END IF;

  -- Add admin_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payout_requests' AND column_name = 'admin_id'
  ) THEN
    ALTER TABLE payout_requests 
      ADD COLUMN admin_id uuid REFERENCES user_profiles(id);
  END IF;

  -- Add processed_at if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payout_requests' AND column_name = 'processed_at'
  ) THEN
    ALTER TABLE payout_requests 
      ADD COLUMN processed_at timestamptz;
  END IF;

  -- Add notes if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payout_requests' AND column_name = 'notes'
  ) THEN
    ALTER TABLE payout_requests 
      ADD COLUMN notes text;
  END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_payout_requests_user_id ON payout_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status);
CREATE INDEX IF NOT EXISTS idx_payout_requests_created_at ON payout_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_payout_requests_user_status ON payout_requests(user_id, status);

-- EARNINGS VIEW
CREATE OR REPLACE VIEW earnings_view AS
WITH 
  gift_earnings AS (
    SELECT 
      receiver_id AS user_id,
      SUM(coins_spent) AS total_coins_earned,
      COUNT(*) AS gift_count,
      DATE_TRUNC('month', created_at) AS month
    FROM gifts
    WHERE receiver_id IS NOT NULL
    GROUP BY receiver_id, DATE_TRUNC('month', created_at)
  ),
  transaction_earnings AS (
    SELECT 
      user_id,
      SUM(amount) AS total_coins_earned,
      COUNT(*) AS transaction_count,
      DATE_TRUNC('month', created_at) AS month
    FROM coin_transactions
    WHERE type IN ('gift_receive', 'gift') 
      AND amount > 0
    GROUP BY user_id, DATE_TRUNC('month', created_at)
  ),
  combined_earnings AS (
    SELECT 
      COALESCE(g.user_id, t.user_id) AS user_id,
      COALESCE(g.month, t.month) AS month,
      COALESCE(g.total_coins_earned, 0) + COALESCE(t.total_coins_earned, 0) AS total_coins,
      COALESCE(g.gift_count, 0) + COALESCE(t.transaction_count, 0) AS transaction_count
    FROM gift_earnings g
    FULL OUTER JOIN transaction_earnings t 
      ON g.user_id = t.user_id AND g.month = t.month
  ),
  payout_summary AS (
    SELECT 
      user_id,
      DATE_TRUNC('month', created_at) AS month,
      SUM(CASE WHEN status = 'paid' THEN COALESCE(cash_amount, 0) ELSE 0 END) AS paid_out_usd,
      SUM(CASE WHEN status = 'pending' THEN COALESCE(cash_amount, 0) ELSE 0 END) AS pending_usd,
      SUM(CASE WHEN status = 'approved' THEN COALESCE(cash_amount, 0) ELSE 0 END) AS approved_usd,
      COUNT(*) FILTER (WHERE status = 'paid') AS paid_count,
      COUNT(*) FILTER (WHERE status = 'pending') AS pending_count
    FROM payout_requests
    GROUP BY user_id, DATE_TRUNC('month', created_at)
  ),
  yearly_payouts AS (
    SELECT 
      user_id,
      DATE_PART('year', created_at)::int AS year,
      SUM(COALESCE(cash_amount, 0)) AS total_paid_usd,
      COUNT(*) AS payout_count
    FROM payout_requests
    WHERE status = 'paid'
    GROUP BY user_id, DATE_PART('year', created_at)
  )
SELECT 
  p.id,
  p.username,
  p.total_earned_coins,
  p.paid_coin_balance,
  p.free_coin_balance,
  COALESCE(ce.total_coins, 0) AS current_month_earnings,
  COALESCE(ce.transaction_count, 0) AS current_month_transactions,
  COALESCE(ps.paid_out_usd, 0) AS current_month_paid_out,
  COALESCE(ps.pending_usd, 0) AS current_month_pending,
  COALESCE(ps.approved_usd, 0) AS current_month_approved,
  COALESCE(ps.paid_count, 0) AS current_month_paid_count,
  COALESCE(ps.pending_count, 0) AS current_month_pending_count,
  COALESCE(yp.total_paid_usd, 0) AS yearly_paid_usd,
  COALESCE(yp.payout_count, 0) AS yearly_payout_count,
  COALESCE(yp.year, DATE_PART('year', NOW())::int) AS tax_year,
  CASE 
    WHEN COALESCE(yp.total_paid_usd, 0) >= 600 THEN 'over_threshold'
    WHEN COALESCE(yp.total_paid_usd, 0) >= 500 THEN 'nearing_threshold'
    ELSE 'below_threshold'
  END AS irs_threshold_status,
  (SELECT MAX(pr.created_at) FROM payout_requests pr WHERE pr.user_id = p.id AND pr.status = 'paid') AS last_payout_at,
  (SELECT COUNT(*) FROM payout_requests pr WHERE pr.user_id = p.id AND pr.status = 'pending') AS pending_requests_count,
  (SELECT SUM(COALESCE(pr.cash_amount, 0)) FROM payout_requests pr WHERE pr.user_id = p.id AND pr.status = 'paid') AS lifetime_paid_usd
FROM user_profiles p
LEFT JOIN combined_earnings ce 
  ON ce.user_id = p.id 
  AND ce.month = DATE_TRUNC('month', NOW())
LEFT JOIN payout_summary ps 
  ON ps.user_id = p.id 
  AND ps.month = DATE_TRUNC('month', NOW())
LEFT JOIN yearly_payouts yp 
  ON yp.user_id = p.id 
  AND yp.year = DATE_PART('year', NOW())::int
WHERE p.is_broadcaster = true OR p.total_earned_coins > 0;

GRANT SELECT ON earnings_view TO authenticated;

-- MONTHLY EARNINGS BREAKDOWN VIEW
CREATE OR REPLACE VIEW monthly_earnings_breakdown AS
SELECT 
  p.id AS user_id,
  p.username,
  DATE_TRUNC('month', g.created_at) AS month,
  SUM(g.coins_spent) AS coins_earned_from_gifts,
  COUNT(DISTINCT g.id) AS gift_count,
  COUNT(DISTINCT g.sender_id) AS unique_gifters,
  SUM(CASE WHEN g.gift_type = 'paid' THEN g.coins_spent ELSE 0 END) AS paid_coins_earned,
  SUM(CASE WHEN g.gift_type = 'free' THEN g.coins_spent ELSE 0 END) AS free_coins_earned
FROM user_profiles p
JOIN gifts g ON g.receiver_id = p.id
WHERE p.is_broadcaster = true OR p.total_earned_coins > 0
GROUP BY p.id, p.username, DATE_TRUNC('month', g.created_at)
ORDER BY month DESC, coins_earned_from_gifts DESC;

GRANT SELECT ON monthly_earnings_breakdown TO authenticated;

-- PAYOUT HISTORY VIEW
CREATE OR REPLACE VIEW payout_history_view AS
SELECT 
  pr.id,
  pr.user_id,
  p.username,
  COALESCE(pr.cash_amount, 0) AS cash_amount,
  COALESCE(pr.coins_redeemed, 0) AS coins_redeemed,
  pr.status,
  pr.created_at,
  pr.processed_at,
  pr.admin_id,
  admin_p.username AS admin_username,
  COALESCE(pr.notes, '') AS notes,
  CASE 
    WHEN COALESCE(pr.cash_amount, 0) > 0 THEN pr.cash_amount
    ELSE (COALESCE(pr.coins_redeemed, 0)::numeric / 100.0)
  END AS usd_equivalent
FROM payout_requests pr
JOIN user_profiles p ON p.id = pr.user_id
LEFT JOIN user_profiles admin_p ON admin_p.id = pr.admin_id
ORDER BY pr.created_at DESC;

GRANT SELECT ON payout_history_view TO authenticated;

-- IRS THRESHOLD TRACKING VIEW
CREATE OR REPLACE VIEW irs_threshold_tracking AS
SELECT 
  p.id AS user_id,
  p.username,
  DATE_PART('year', pr.created_at)::int AS year,
  SUM(COALESCE(pr.cash_amount, 0)) AS total_paid_usd,
  COUNT(*) AS payout_count,
  CASE 
    WHEN SUM(COALESCE(pr.cash_amount, 0)) >= 600 THEN true
    ELSE false
  END AS requires_1099,
  CASE 
    WHEN SUM(COALESCE(pr.cash_amount, 0)) >= 600 THEN 'REQUIRED'
    WHEN SUM(COALESCE(pr.cash_amount, 0)) >= 500 THEN 'WARNING'
    ELSE 'OK'
  END AS threshold_status,
  MAX(pr.created_at) AS last_payout_date
FROM user_profiles p
JOIN payout_requests pr ON pr.user_id = p.id
WHERE pr.status = 'paid'
GROUP BY p.id, p.username, DATE_PART('year', pr.created_at)
ORDER BY year DESC, total_paid_usd DESC;

GRANT SELECT ON irs_threshold_tracking TO authenticated;

-- ============================================
-- 3. GET MONTHLY EARNINGS RPC
-- ============================================

CREATE OR REPLACE FUNCTION get_monthly_earnings(p_user_id uuid)
RETURNS TABLE (
  month text,
  coins_earned_from_gifts bigint,
  gift_count bigint,
  unique_gifters bigint,
  paid_coins_earned bigint,
  free_coins_earned bigint,
  usd_equivalent numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TO_CHAR(DATE_TRUNC('month', g.created_at), 'YYYY-MM') AS month,
    SUM(g.coins_spent)::bigint AS coins_earned_from_gifts,
    COUNT(DISTINCT g.id)::bigint AS gift_count,
    COUNT(DISTINCT g.sender_id)::bigint AS unique_gifters,
    SUM(CASE WHEN g.gift_type = 'paid' THEN g.coins_spent ELSE 0 END)::bigint AS paid_coins_earned,
    SUM(CASE WHEN g.gift_type = 'free' THEN g.coins_spent ELSE 0 END)::bigint AS free_coins_earned,
    (SUM(g.coins_spent)::numeric / 100.0) AS usd_equivalent
  FROM gifts g
  WHERE g.receiver_id = p_user_id
  GROUP BY DATE_TRUNC('month', g.created_at)
  ORDER BY DATE_TRUNC('month', g.created_at) DESC
  LIMIT 12;
END;
$$;

GRANT EXECUTE ON FUNCTION get_monthly_earnings(uuid) TO authenticated;

-- ============================================
-- 4. REQUEST PAYOUT RPC
-- ============================================

CREATE OR REPLACE FUNCTION request_payout(
  p_user_id uuid,
  p_coins_to_redeem bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance bigint;
  v_usd_amount numeric(10,2);
  v_payout_id uuid;
  v_minimum_coins bigint := 5000;
  v_conversion_rate numeric := 0.01;
BEGIN
  SELECT paid_coin_balance INTO v_current_balance
  FROM user_profiles
  WHERE id = p_user_id;

  IF v_current_balance IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User profile not found'
    );
  END IF;

  IF p_coins_to_redeem < v_minimum_coins THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Minimum withdrawal is %s coins ($%s)', v_minimum_coins, (v_minimum_coins * v_conversion_rate))
    );
  END IF;

  IF p_coins_to_redeem > v_current_balance THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Insufficient balance. Available: %s coins', v_current_balance)
    );
  END IF;

  v_usd_amount := p_coins_to_redeem * v_conversion_rate;
  v_payout_id := gen_random_uuid();

  INSERT INTO payout_requests (
    id,
    user_id,
    coins_redeemed,
    cash_amount,
    status,
    created_at
  ) VALUES (
    v_payout_id,
    p_user_id,
    p_coins_to_redeem,
    v_usd_amount,
    'pending',
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'payout_request_id', v_payout_id,
    'updated_balance', v_current_balance,
    'coins_redeemed', p_coins_to_redeem,
    'usd_amount', v_usd_amount
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

GRANT EXECUTE ON FUNCTION request_payout(uuid, bigint) TO authenticated;

