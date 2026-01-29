-- Migration to support Admin Finance (Visa Redemptions & Cashouts) and Atomic Applications
-- 1. Create visa_redemptions table (for GiftCardFulfillmentList.tsx)
-- 2. Add columns to cashout_requests (for CashoutRequestsList.tsx)
-- 3. Create RPCs for visa redemption and cashout fulfillment
-- 4. Create RPC for atomic seller application approval

-- ============================================================================
-- 1. Visa Redemptions (New Table)
-- ============================================================================
CREATE TABLE IF NOT EXISTS visa_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  coins_reserved INTEGER NOT NULL CHECK (coins_reserved > 0),
  usd_amount NUMERIC(10, 2) NOT NULL CHECK (usd_amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'fulfilled', 'rejected')),
  giftcard_code TEXT, -- Only populated when fulfilled
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  processed_by UUID REFERENCES user_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_visa_redemptions_user_id ON visa_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_visa_redemptions_status ON visa_redemptions(status);

-- ============================================================================
-- 2. Cashout Requests (Enhancements)
-- ============================================================================
-- Add gift_card_code if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cashout_requests' AND column_name = 'gift_card_code') THEN
    ALTER TABLE cashout_requests ADD COLUMN gift_card_code TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cashout_requests' AND column_name = 'approved_by') THEN
    ALTER TABLE cashout_requests ADD COLUMN approved_by UUID REFERENCES user_profiles(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cashout_requests' AND column_name = 'approved_at') THEN
    ALTER TABLE cashout_requests ADD COLUMN approved_at TIMESTAMPTZ;
  END IF;
END $$;

-- ============================================================================
-- 3. RPCs for Finance
-- ============================================================================

-- Approve Visa Redemption
DROP FUNCTION IF EXISTS approve_visa_redemption(UUID);
CREATE OR REPLACE FUNCTION approve_visa_redemption(p_redemption_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE visa_redemptions
  SET status = 'approved',
      approved_at = NOW(),
      processed_by = auth.uid()
  WHERE id = p_redemption_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Redemption not found or not pending';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fulfill Visa Redemption
DROP FUNCTION IF EXISTS fulfill_visa_redemption(UUID, TEXT);
CREATE OR REPLACE FUNCTION fulfill_visa_redemption(p_redemption_id UUID, p_giftcard_code TEXT)
RETURNS VOID AS $$
BEGIN
  IF p_giftcard_code IS NULL OR length(p_giftcard_code) < 5 THEN
    RAISE EXCEPTION 'Invalid gift card code';
  END IF;

  UPDATE visa_redemptions
  SET status = 'fulfilled',
      fulfilled_at = NOW(),
      giftcard_code = p_giftcard_code,
      processed_by = auth.uid()
  WHERE id = p_redemption_id AND (status = 'pending' OR status = 'approved');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Redemption not found or already processed';
  END IF;

  -- Notification
  INSERT INTO notifications (user_id, type, title, message, metadata)
  SELECT user_id, 'payout_status', 'Visa Gift Card Ready!', 'Your Visa eGift card has been issued.', jsonb_build_object('redemption_id', p_redemption_id)
  FROM visa_redemptions WHERE id = p_redemption_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reject Visa Redemption
DROP FUNCTION IF EXISTS reject_visa_redemption(UUID, TEXT);
CREATE OR REPLACE FUNCTION reject_visa_redemption(p_redemption_id UUID, p_reason TEXT)
RETURNS VOID AS $$
DECLARE
  v_user_id UUID;
  v_coins INTEGER;
BEGIN
  SELECT user_id, coins_reserved INTO v_user_id, v_coins
  FROM visa_redemptions WHERE id = p_redemption_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Redemption not found'; END IF;

  -- Refund
  UPDATE user_profiles SET troll_coins = troll_coins + v_coins WHERE id = v_user_id;

  UPDATE visa_redemptions
  SET status = 'rejected',
      rejected_at = NOW(),
      rejection_reason = p_reason,
      processed_by = auth.uid()
  WHERE id = p_redemption_id;

  INSERT INTO coin_transactions (user_id, amount, type, description)
  VALUES (v_user_id, v_coins, 'refund', 'Refund for rejected Visa redemption');

  INSERT INTO notifications (user_id, type, title, message)
  VALUES (v_user_id, 'payout_status', 'Redemption Rejected', 'Your Visa redemption was rejected. Coins have been refunded.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fulfill Cashout Request (For CashoutRequestsList.tsx)
DROP FUNCTION IF EXISTS fulfill_cashout_request(UUID, UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION fulfill_cashout_request(
  p_request_id UUID,
  p_admin_id UUID,
  p_notes TEXT,
  p_gift_card_code TEXT
) RETURNS VOID AS $$
BEGIN
  UPDATE cashout_requests
  SET status = 'fulfilled',
      processed_at = NOW(),
      notes = p_notes,
      gift_card_code = p_gift_card_code
  WHERE id = p_request_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cashout request not found';
  END IF;

  -- Notification
  INSERT INTO notifications (user_id, type, title, message, metadata)
  SELECT user_id, 'payout_status', 'Cashout Fulfilled!', 'Your cashout request has been fulfilled.', jsonb_build_object('request_id', p_request_id)
  FROM cashout_requests WHERE id = p_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Process Cashout Refund (For CashoutRequestsList.tsx)
DROP FUNCTION IF EXISTS process_cashout_refund(UUID, UUID, TEXT);
CREATE OR REPLACE FUNCTION process_cashout_refund(
  p_request_id UUID,
  p_admin_id UUID,
  p_notes TEXT
) RETURNS VOID AS $$
DECLARE
  v_user_id UUID;
  v_coins INTEGER;
BEGIN
  SELECT user_id, coins_redeemed INTO v_user_id, v_coins
  FROM cashout_requests WHERE id = p_request_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;

  -- Refund
  UPDATE user_profiles SET troll_coins = troll_coins + v_coins WHERE id = v_user_id;

  UPDATE cashout_requests
  SET status = 'denied',
      processed_at = NOW(),
      notes = p_notes
  WHERE id = p_request_id;

  INSERT INTO coin_transactions (user_id, amount, type, description)
  VALUES (v_user_id, v_coins, 'refund', 'Refund for denied cashout request');

  INSERT INTO notifications (user_id, type, title, message)
  VALUES (v_user_id, 'payout_status', 'Cashout Denied', 'Your cashout request was denied. Coins have been refunded.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- 4. Atomic Seller Application Approval
-- ============================================================================
DROP FUNCTION IF EXISTS approve_seller_application(UUID, UUID);
CREATE OR REPLACE FUNCTION approve_seller_application(p_application_id UUID, p_reviewer_id UUID)
RETURNS JSON AS $$
DECLARE
  v_app_user_id UUID;
  v_app_data RECORD;
BEGIN
  -- Get application data
  SELECT * INTO v_app_data FROM applications WHERE id = p_application_id AND type = 'seller';
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Application not found or not a seller application');
  END IF;

  v_app_user_id := v_app_data.user_id;

  -- 1. Update Application Status
  UPDATE applications 
  SET status = 'approved',
      reviewed_by = p_reviewer_id,
      reviewed_at = NOW()
  WHERE id = p_application_id;

  -- 2. Update User Role
  UPDATE user_profiles
  SET role = 'seller'
  WHERE id = v_app_user_id;

  -- 3. Create Notification
  INSERT INTO notifications (user_id, type, title, message)
  VALUES (v_app_user_id, 'system', 'Application Approved', 'Your seller application has been approved! You can now access the seller dashboard.');

  RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
