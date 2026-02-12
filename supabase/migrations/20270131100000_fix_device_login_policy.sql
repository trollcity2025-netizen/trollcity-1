-- 1. Fix device login policy (allow multi-device for admins/officers)
CREATE OR REPLACE FUNCTION "public"."register_session"("p_user_id" "uuid", "p_session_id" "uuid", "p_device_info" "jsonb" DEFAULT '{}'::"jsonb", "p_ip_address" "text" DEFAULT NULL::"text", "p_user_agent" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_role text;
  v_is_admin boolean;
  v_is_officer boolean;
  v_is_lead_officer boolean;
  v_officer_role text;
BEGIN
    -- Get user role info
    SELECT role, is_admin, is_troll_officer, is_lead_officer, officer_role
    INTO v_role, v_is_admin, v_is_officer, v_is_lead_officer, v_officer_role
    FROM user_profiles
    WHERE id = p_user_id;

    -- Deactivate any existing sessions for this user if NOT admin/officer/secretary
    -- Allow multiple devices for: Admin, Secretary, Officers
    IF NOT (
        v_role = 'admin' OR 
        v_role = 'secretary' OR
        v_is_admin = true OR 
        v_is_officer = true OR 
        v_is_lead_officer = true OR
        v_role = 'troll_officer' OR
        v_role = 'lead_troll_officer' OR
        v_officer_role IS NOT NULL
    ) THEN
        UPDATE active_sessions
        SET is_active = FALSE, last_active = NOW()
        WHERE user_id = p_user_id AND is_active = TRUE;
    END IF;
    
    -- Insert new session
    INSERT INTO active_sessions (user_id, session_id, device_info, ip_address, user_agent)
    VALUES (p_user_id, p_session_id, p_device_info, p_ip_address, p_user_agent)
    ON CONFLICT (user_id, session_id) DO UPDATE
    SET is_active = TRUE, last_active = NOW(), device_info = p_device_info, 
        ip_address = p_ip_address, user_agent = p_user_agent;
END;
$$;

-- 2. Update economy_summary view for Admin Finance Dashboard
DROP VIEW IF EXISTS "public"."economy_summary";
CREATE OR REPLACE VIEW "public"."economy_summary" WITH ("security_invoker"='true') AS
WITH 
  revenue_stats AS (
    SELECT 
      COALESCE(SUM(usd_amount), 0) as total_revenue_usd
    FROM coin_transactions 
    WHERE type = 'store_purchase' AND status = 'completed'
  ),
  circulation_stats AS (
    SELECT
      COALESCE(SUM(coin_balance + free_coin_balance), 0) as total_coins_in_circulation    
    FROM user_profiles
    WHERE (role IS DISTINCT FROM 'admin') AND (is_admin IS DISTINCT FROM true)
  ),
  gift_stats AS (
    SELECT 
      COALESCE(SUM(ABS(amount)), 0) as total_gift_coins_spent
    FROM coin_transactions 
    WHERE type = 'gift'
  ),
  payout_stats AS (
    SELECT 
      COALESCE(SUM(amount_usd) FILTER (WHERE status = 'paid'), 0) as total_payouts_processed_usd,
      COALESCE(SUM(amount_usd) FILTER (WHERE status = 'pending'), 0) as total_pending_payouts_usd
    FROM payout_requests
  ),
  creator_stats AS (
    SELECT 
      COALESCE(SUM(coins_awarded), 0) as total_creator_earned_coins
    FROM coin_transactions 
    WHERE type = 'gift'
  ),
  top_broadcaster AS (
    SELECT 
      to_user_name as top_earning_broadcaster
    FROM coin_transactions 
    WHERE type = 'gift' AND coins_awarded > 0
    GROUP BY to_user_name
    ORDER BY SUM(coins_awarded) DESC
    LIMIT 1
  )
SELECT 
  (SELECT total_revenue_usd FROM revenue_stats) as total_revenue_usd,
  (SELECT total_coins_in_circulation FROM circulation_stats) as total_coins_in_circulation,
  (SELECT total_gift_coins_spent FROM gift_stats) as total_gift_coins_spent,
  (SELECT total_payouts_processed_usd FROM payout_stats) as total_payouts_processed_usd,
  (SELECT total_pending_payouts_usd FROM payout_stats) as total_pending_payouts_usd,
  (SELECT total_creator_earned_coins FROM creator_stats) as total_creator_earned_coins,
  (SELECT top_earning_broadcaster FROM top_broadcaster) as top_earning_broadcaster;

-- 3. Enable RLS on active_sessions to allow users to subscribe to their own session status
ALTER TABLE "public"."active_sessions" ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'active_sessions' AND policyname = 'Users can read own active sessions'
  ) THEN
    CREATE POLICY "Users can read own active sessions" ON "public"."active_sessions"
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
END $$;
