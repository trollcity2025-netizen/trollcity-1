-- Master Migration: Fixes for all reported bugs
-- Date: 2027-03-22
-- Fixes:
--   1. get_user_conversations_optimized - conversation_id ambiguous
--   2. get_market_stats - stock_symbol must appear in GROUP BY
--   3. neighbors_businesses.approval_status column missing (add it)
--   4. troll_families.icon_emoji column missing (add it)
--   5. submit_cashout_request missing p_usd_value parameter

-- ============================================================
-- 1. FIX: get_user_conversations_optimized - conversation_id ambiguous
--    Renamed intermediate columns to avoid ambiguity in RETURN QUERY
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_conversations_optimized(p_user_id UUID)
RETURNS TABLE (
  conversation_id UUID,
  other_user_id UUID,
  other_username TEXT,
  other_avatar_url TEXT,
  last_message TEXT,
  last_timestamp TIMESTAMPTZ,
  unread_count BIGINT,
  is_online BOOLEAN,
  rgb_username_expires_at TIMESTAMPTZ,
  glowing_username_color TEXT,
  other_created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH user_conversations AS (
    SELECT cm.conversation_id AS conv_id
    FROM conversation_members cm
    WHERE cm.user_id = p_user_id
  ),
  other_members AS (
    SELECT 
      cm.conversation_id AS conv_id,
      cm.user_id AS other_user_id,
      up.username AS other_username,
      up.avatar_url AS other_avatar_url,
      up.rgb_username_expires_at,
      up.glowing_username_color,
      up.created_at AS other_created_at
    FROM conversation_members cm
    JOIN user_profiles up ON cm.user_id = up.id
    WHERE cm.conversation_id IN (SELECT uc.conv_id FROM user_conversations uc)
      AND cm.user_id != p_user_id
  ),
  last_messages AS (
    SELECT DISTINCT ON (msg.conversation_id)
      msg.conversation_id AS conv_id,
      msg.body AS last_message,
      msg.created_at AS last_timestamp
    FROM conversation_messages msg
    WHERE msg.conversation_id IN (SELECT uc.conv_id FROM user_conversations uc)
      AND msg.is_deleted = false
    ORDER BY msg.conversation_id, msg.created_at DESC
  ),
  unread_counts AS (
    SELECT 
      msg.conversation_id AS conv_id,
      COUNT(*)::BIGINT AS unread_count
    FROM conversation_messages msg
    WHERE msg.conversation_id IN (SELECT uc.conv_id FROM user_conversations uc)
      AND msg.sender_id != p_user_id
      AND msg.read_at IS NULL
      AND msg.is_deleted = FALSE
    GROUP BY msg.conversation_id
  )
  SELECT 
    om.conv_id,
    om.other_user_id,
    om.other_username,
    om.other_avatar_url,
    COALESCE(lm.last_message, 'No messages yet'::TEXT),
    COALESCE(lm.last_timestamp, '1970-01-01'::TIMESTAMPTZ),
    COALESCE(uc.unread_count, 0::BIGINT),
    FALSE,
    om.rgb_username_expires_at,
    om.glowing_username_color,
    om.other_created_at
  FROM other_members om
  LEFT JOIN last_messages lm ON om.conv_id = lm.conv_id
  LEFT JOIN unread_counts uc ON om.conv_id = uc.conv_id

  ORDER BY lm.last_timestamp DESC NULLS LAST;
END;
$$;

-- ============================================================
-- 2. FIX: get_market_stats - stock_symbol must appear in GROUP BY
--    Rewrote using subqueries to avoid window function + aggregate conflict
-- ============================================================
CREATE OR REPLACE FUNCTION get_market_stats()
RETURNS TABLE(
    total_stocks INTEGER,
    total_volume BIGINT,
    avg_price DECIMAL(15,2),
    top_gainer_stock VARCHAR,
    top_gainer_change DECIMAL(10,2),
    most_traded_stock VARCHAR,
    most_traded_volume BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*)::INTEGER FROM stocks WHERE is_active = TRUE),
        (SELECT COALESCE(SUM(volume), 0)::BIGINT FROM stocks WHERE is_active = TRUE),
        (SELECT COALESCE(AVG(current_price), 0)::DECIMAL(15,2) FROM stocks WHERE is_active = TRUE),
        (SELECT stock_symbol FROM stocks WHERE is_active = TRUE ORDER BY price_change_pct_24h DESC NULLS LAST LIMIT 1),
        (SELECT MAX(price_change_pct_24h)::DECIMAL(10,2) FROM stocks WHERE is_active = TRUE),
        (SELECT stock_symbol FROM stocks WHERE is_active = TRUE ORDER BY volume DESC NULLS LAST LIMIT 1),
        (SELECT MAX(volume)::BIGINT FROM stocks WHERE is_active = TRUE);
END;
$$;

-- ============================================================
-- 3. FIX: neighbors_businesses.approval_status column does not exist
--    Add the approval_status column if it doesn't exist
-- ============================================================
ALTER TABLE neighbors_businesses 
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected'));

ALTER TABLE neighbors_businesses 
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE neighbors_events 
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected'));

ALTER TABLE neighbors_events 
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE neighbors_hiring 
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- Backfill existing rows: set approval_status based on verified column
UPDATE neighbors_businesses SET approval_status = 'approved' WHERE verified = TRUE AND approval_status IS NULL;
UPDATE neighbors_businesses SET approval_status = 'pending' WHERE verified = FALSE AND approval_status IS NULL;

-- Index for approval lookups
CREATE INDEX IF NOT EXISTS idx_neighbors_businesses_approval_status ON neighbors_businesses(approval_status);
CREATE INDEX IF NOT EXISTS idx_neighbors_events_approval_status ON neighbors_events(approval_status);

-- ============================================================
-- 4. FIX: troll_families.icon_emoji column does not exist
--    Add the icon_emoji column if it doesn't exist
-- ============================================================
ALTER TABLE troll_families 
ADD COLUMN IF NOT EXISTS icon_emoji TEXT;

-- Backfill icon_emoji with default for rows that don't have one yet
UPDATE troll_families SET icon_emoji = '👑' WHERE icon_emoji IS NULL;

-- ============================================================
-- 5. FIX: submit_cashout_request - ensure correct 5-parameter version exists
--    This version uses p_usd_value from the caller
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_cashout_request(
    p_user_id UUID,
    p_amount_coins BIGINT,
    p_usd_value NUMERIC,
    p_provider TEXT,
    p_delivery_method TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_req_id UUID;
    v_has_prior_payouts BOOLEAN;
    v_is_held BOOLEAN := false;
    v_held_reason TEXT := NULL;
    v_release_date TIMESTAMPTZ := NULL;
    v_is_new_user_hold BOOLEAN := false;
BEGIN
    -- Check for prior successful payouts to determine if new user hold applies
    SELECT EXISTS (
        SELECT 1 FROM public.cashout_requests 
        WHERE user_id = p_user_id 
        AND status IN ('paid', 'fulfilled')
    ) INTO v_has_prior_payouts;

    IF NOT v_has_prior_payouts THEN
        v_is_held := true;
        v_held_reason := 'New User 7 Day Hold';
        v_release_date := NOW() + INTERVAL '7 days';
        v_is_new_user_hold := true;
    END IF;

    -- Create Request
    INSERT INTO public.cashout_requests (
        user_id, 
        requested_coins, 
        usd_value, 
        payout_method, 
        payout_details, 
        status,
        is_held,
        held_reason,
        release_date,
        is_new_user_hold
    ) VALUES (
        p_user_id, 
        p_amount_coins, 
        p_usd_value, 
        p_provider, 
        p_delivery_method, 
        'pending',
        v_is_held,
        v_held_reason,
        v_release_date,
        v_is_new_user_hold
    ) RETURNING id INTO v_req_id;

    -- Lock Coins
    BEGIN
        PERFORM public.troll_bank_escrow_coins(p_user_id, p_amount_coins, v_req_id);
    EXCEPTION WHEN OTHERS THEN
        DELETE FROM public.cashout_requests WHERE id = v_req_id;
        RAISE EXCEPTION 'Failed to escrow coins: %', SQLERRM;
    END;

    RETURN json_build_object(
        'success', true, 
        'request_id', v_req_id, 
        'is_held', v_is_held,
        'release_date', v_release_date
    );
END;
$$;
