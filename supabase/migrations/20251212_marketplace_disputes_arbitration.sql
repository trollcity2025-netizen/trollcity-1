-- Marketplace Disputes and Arbitration System
-- Created: 2025-12-12
-- Purpose: Complete the seller marketplace with dispute resolution, refunds, and anti-fraud holds

-- 1. Create marketplace_disputes table
CREATE TABLE IF NOT EXISTS marketplace_disputes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_id UUID NOT NULL REFERENCES marketplace_purchases(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES user_profiles(id),
  seller_id UUID NOT NULL REFERENCES user_profiles(id),
  dispute_type VARCHAR(50) NOT NULL CHECK (dispute_type IN ('item_not_received', 'item_damaged', 'wrong_item', 'seller_no_response', 'fraud_suspected', 'other')),
  dispute_reason TEXT NOT NULL,
  evidence_urls TEXT[], -- Array of evidence file URLs
  dispute_amount BIGINT NOT NULL, -- Amount in dispute (coins)
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'arbitration', 'resolved_buyer', 'resolved_seller', 'cancelled')),
  resolution TEXT,
  refund_amount BIGINT DEFAULT 0,
  platform_fee_deducted BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES user_profiles(id),
  arbitration_deadline TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),

  -- Ensure buyer/seller match the purchase
  CONSTRAINT valid_dispute_parties CHECK (
    buyer_id = (SELECT buyer_id FROM marketplace_purchases WHERE id = purchase_id) AND
    seller_id = (SELECT seller_id FROM marketplace_purchases WHERE id = purchase_id)
  ),

  -- Only one active dispute per purchase
  CONSTRAINT unique_active_dispute_per_purchase EXCLUDE (
    purchase_id WITH =,
    status WITH <>
  ) WHERE (status IN ('pending', 'under_review', 'arbitration'))
);

-- 2. Create dispute_arbitration_log table for tracking arbitration process
CREATE TABLE IF NOT EXISTS dispute_arbitration_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dispute_id UUID NOT NULL REFERENCES marketplace_disputes(id) ON DELETE CASCADE,
  action_by UUID NOT NULL REFERENCES user_profiles(id),
  action_type VARCHAR(50) NOT NULL, -- 'escalated', 'evidence_requested', 'decision_made', 'appeal_filed'
  action_details TEXT,
  old_status VARCHAR(20),
  new_status VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add anti-fraud hold fields to seller_balances
ALTER TABLE seller_balances
ADD COLUMN IF NOT EXISTS fraud_hold_coins BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS fraud_hold_reason TEXT,
ADD COLUMN IF NOT EXISTS fraud_hold_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_fraud_check TIMESTAMPTZ DEFAULT NOW();

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_marketplace_disputes_purchase_id ON marketplace_disputes(purchase_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_disputes_status ON marketplace_disputes(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_disputes_buyer_id ON marketplace_disputes(buyer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_disputes_seller_id ON marketplace_disputes(seller_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_disputes_arbitration_deadline ON marketplace_disputes(arbitration_deadline);
CREATE INDEX IF NOT EXISTS idx_dispute_arbitration_log_dispute_id ON dispute_arbitration_log(dispute_id);
CREATE INDEX IF NOT EXISTS idx_seller_balances_fraud_hold ON seller_balances(fraud_hold_until) WHERE fraud_hold_until IS NOT NULL;

-- 5. Enable RLS
ALTER TABLE marketplace_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_arbitration_log ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for marketplace_disputes
-- Buyers can view their own disputes
CREATE POLICY "Buyers can view their own disputes"
  ON marketplace_disputes FOR SELECT
  USING (buyer_id = auth.uid());

-- Sellers can view disputes against them
CREATE POLICY "Sellers can view disputes against them"
  ON marketplace_disputes FOR SELECT
  USING (seller_id = auth.uid());

-- Officers and admins can view all disputes
CREATE POLICY "Officers can view all disputes"
  ON marketplace_disputes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'officer')
    )
  );

-- Users can create disputes for their purchases
CREATE POLICY "Users can create disputes for their purchases"
  ON marketplace_disputes FOR INSERT
  WITH CHECK (
    buyer_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM marketplace_purchases mp
      WHERE mp.id = purchase_id
      AND mp.buyer_id = auth.uid()
      AND mp.fulfillment_status = 'fulfilled'
    )
  );

-- Officers and admins can update disputes
CREATE POLICY "Officers can update disputes"
  ON marketplace_disputes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'officer')
    )
  );

-- 7. RLS Policies for dispute_arbitration_log
-- Users can view logs for disputes they're involved in
CREATE POLICY "Users can view arbitration logs for their disputes"
  ON dispute_arbitration_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM marketplace_disputes md
      WHERE md.id = dispute_id
      AND (md.buyer_id = auth.uid() OR md.seller_id = auth.uid())
    )
  );

-- Officers and admins can view all arbitration logs
CREATE POLICY "Officers can view all arbitration logs"
  ON dispute_arbitration_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'officer')
    )
  );

-- Officers and admins can create arbitration logs
CREATE POLICY "Officers can create arbitration logs"
  ON dispute_arbitration_log FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'officer')
    )
  );

-- 8. Function to create a marketplace dispute
CREATE OR REPLACE FUNCTION create_marketplace_dispute(
  p_purchase_id UUID,
  p_dispute_type VARCHAR(50),
  p_dispute_reason TEXT,
  p_evidence_urls TEXT[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchase RECORD;
  v_dispute_id UUID;
  v_dispute_amount BIGINT;
BEGIN
  -- Get purchase details
  SELECT * INTO v_purchase
  FROM marketplace_purchases
  WHERE id = p_purchase_id AND buyer_id = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Purchase not found or not authorized');
  END IF;

  -- Check if purchase is fulfilled (only fulfilled purchases can be disputed)
  IF v_purchase.fulfillment_status != 'fulfilled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Can only dispute fulfilled purchases');
  END IF;

  -- Check if dispute already exists
  IF EXISTS (
    SELECT 1 FROM marketplace_disputes
    WHERE purchase_id = p_purchase_id
    AND status IN ('pending', 'under_review', 'arbitration')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dispute already exists for this purchase');
  END IF;

  -- Calculate dispute amount (full purchase price)
  v_dispute_amount := v_purchase.price_paid;

  -- Create dispute
  INSERT INTO marketplace_disputes (
    purchase_id, buyer_id, seller_id, dispute_type, dispute_reason,
    evidence_urls, dispute_amount
  ) VALUES (
    p_purchase_id, v_purchase.buyer_id, v_purchase.seller_id, p_dispute_type,
    p_dispute_reason, p_evidence_urls, v_dispute_amount
  ) RETURNING id INTO v_dispute_id;

  -- Log arbitration action
  INSERT INTO dispute_arbitration_log (
    dispute_id, action_by, action_type, action_details, new_status
  ) VALUES (
    v_dispute_id, auth.uid(), 'dispute_filed',
    'Buyer filed dispute: ' || p_dispute_type, 'pending'
  );

  -- Create notification for seller
  INSERT INTO notifications (
    user_id, type, title, message, metadata
  ) VALUES (
    v_purchase.seller_id,
    'marketplace_dispute_filed',
    'Dispute Filed Against Your Sale',
    'A buyer has filed a dispute for one of your marketplace sales',
    jsonb_build_object('dispute_id', v_dispute_id, 'purchase_id', p_purchase_id)
  );

  -- Create notification for admins/officers
  INSERT INTO notifications (
    user_id, type, title, message, metadata
  )
  SELECT
    up.id,
    'marketplace_dispute_admin',
    'New Marketplace Dispute',
    'A new marketplace dispute requires review',
    jsonb_build_object('dispute_id', v_dispute_id, 'purchase_id', p_purchase_id)
  FROM user_profiles up
  WHERE up.role IN ('admin', 'officer');

  RETURN jsonb_build_object(
    'success', true,
    'dispute_id', v_dispute_id,
    'message', 'Dispute filed successfully'
  );
END;
$$;

-- 9. Function to resolve marketplace dispute
CREATE OR REPLACE FUNCTION resolve_marketplace_dispute(
  p_dispute_id UUID,
  p_resolution TEXT,
  p_refund_amount BIGINT DEFAULT 0,
  p_platform_fee_deducted BIGINT DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dispute RECORD;
  v_purchase RECORD;
  v_admin_check BOOLEAN;
  v_refund_coins BIGINT;
  v_platform_fee BIGINT;
BEGIN
  -- Check if user is admin/officer
  SELECT EXISTS(
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role IN ('admin', 'officer')
  ) INTO v_admin_check;

  IF NOT v_admin_check THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admins can resolve disputes');
  END IF;

  -- Get dispute details
  SELECT * INTO v_dispute
  FROM marketplace_disputes
  WHERE id = p_dispute_id AND status IN ('pending', 'under_review', 'arbitration');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dispute not found or already resolved');
  END IF;

  -- Get purchase details
  SELECT * INTO v_purchase
  FROM marketplace_purchases
  WHERE id = v_dispute.purchase_id;

  -- Determine resolution status and refund logic
  IF p_refund_amount > 0 THEN
    -- Buyer wins - refund coins
    v_refund_coins := LEAST(p_refund_amount, v_purchase.price_paid);

    -- Return coins to buyer
    UPDATE user_profiles
    SET paid_coin_balance = paid_coin_balance + v_refund_coins,
        total_spent_coins = total_spent_coins - v_refund_coins,
        updated_at = NOW()
    WHERE id = v_purchase.buyer_id;

    -- Deduct from seller's available balance
    UPDATE seller_balances
    SET available_coins = available_coins - v_refund_coins,
        updated_at = NOW()
    WHERE seller_id = v_purchase.seller_id;

    -- Log refund transaction for buyer
    INSERT INTO coin_transactions (
      user_id, type, coins, coin_type, description, metadata
    ) VALUES (
      v_purchase.buyer_id,
      'marketplace_refund',
      v_refund_coins,
      'earned',
      'Refund from marketplace dispute resolution',
      jsonb_build_object('dispute_id', p_dispute_id, 'purchase_id', v_purchase.id)
    );

    -- Log deduction for seller
    INSERT INTO coin_transactions (
      user_id, type, coins, coin_type, description, metadata
    ) VALUES (
      v_purchase.seller_id,
      'marketplace_deduction',
      -v_refund_coins,
      'earned',
      'Coins deducted due to marketplace dispute',
      jsonb_build_object('dispute_id', p_dispute_id, 'purchase_id', v_purchase.id)
    );

    -- Update dispute status
    UPDATE marketplace_disputes
    SET status = 'resolved_buyer',
        resolution = p_resolution,
        refund_amount = v_refund_coins,
        platform_fee_deducted = p_platform_fee_deducted,
        resolved_at = NOW(),
        resolved_by = auth.uid(),
        updated_at = NOW()
    WHERE id = p_dispute_id;

  ELSE
    -- Seller wins - no refund
    UPDATE marketplace_disputes
    SET status = 'resolved_seller',
        resolution = p_resolution,
        resolved_at = NOW(),
        resolved_by = auth.uid(),
        updated_at = NOW()
    WHERE id = p_dispute_id;
  END IF;

  -- Log arbitration action
  INSERT INTO dispute_arbitration_log (
    dispute_id, action_by, action_type, action_details,
    old_status, new_status
  ) VALUES (
    p_dispute_id, auth.uid(), 'decision_made',
    'Dispute resolved: ' || p_resolution,
    v_dispute.status,
    CASE WHEN p_refund_amount > 0 THEN 'resolved_buyer' ELSE 'resolved_seller' END
  );

  -- Create notifications
  -- For buyer
  INSERT INTO notifications (
    user_id, type, title, message, metadata
  ) VALUES (
    v_dispute.buyer_id,
    'dispute_resolved',
    'Marketplace Dispute Resolved',
    CASE WHEN p_refund_amount > 0
      THEN 'Your dispute has been resolved in your favor. Refund of ' || v_refund_coins || ' coins processed.'
      ELSE 'Your dispute has been resolved. ' || p_resolution
    END,
    jsonb_build_object('dispute_id', p_dispute_id, 'refund_amount', v_refund_coins)
  );

  -- For seller
  INSERT INTO notifications (
    user_id, type, title, message, metadata
  ) VALUES (
    v_dispute.seller_id,
    'dispute_resolved',
    'Marketplace Dispute Resolved',
    CASE WHEN p_refund_amount > 0
      THEN 'A dispute against your sale has been resolved. ' || v_refund_coins || ' coins were refunded to the buyer.'
      ELSE 'A dispute against your sale has been resolved in your favor. ' || p_resolution
    END,
    jsonb_build_object('dispute_id', p_dispute_id, 'refund_amount', v_refund_coins)
  );

  RETURN jsonb_build_object(
    'success', true,
    'resolution', CASE WHEN p_refund_amount > 0 THEN 'buyer' ELSE 'seller' END,
    'refund_amount', COALESCE(v_refund_coins, 0)
  );
END;
$$;

-- 10. Function to apply anti-fraud holds on seller payouts
CREATE OR REPLACE FUNCTION apply_fraud_hold(
  p_seller_id UUID,
  p_hold_amount BIGINT,
  p_reason TEXT,
  p_hold_days INTEGER DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available_coins BIGINT;
  v_admin_check BOOLEAN;
BEGIN
  -- Check if user is admin/officer
  SELECT EXISTS(
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role IN ('admin', 'officer')
  ) INTO v_admin_check;

  IF NOT v_admin_check THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admins can apply fraud holds');
  END IF;

  -- Get current available balance
  SELECT available_coins INTO v_available_coins
  FROM seller_balances
  WHERE seller_id = p_seller_id;

  IF v_available_coins < p_hold_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient available coins for hold');
  END IF;

  -- Apply fraud hold
  UPDATE seller_balances
  SET available_coins = available_coins - p_hold_amount,
      fraud_hold_coins = fraud_hold_coins + p_hold_amount,
      fraud_hold_reason = p_reason,
      fraud_hold_until = NOW() + INTERVAL '1 day' * p_hold_days,
      last_fraud_check = NOW(),
      updated_at = NOW()
  WHERE seller_id = p_seller_id;

  -- Log the fraud hold
  INSERT INTO seller_history (
    seller_id, event_type, event_subtype, severity, title, description,
    metadata, moderator_id
  ) VALUES (
    p_seller_id, 'fraud_hold', 'payout_hold', 'high',
    'Fraud Hold Applied',
    'Payout hold applied due to suspected fraud: ' || p_reason,
    jsonb_build_object('hold_amount', p_hold_amount, 'hold_days', p_hold_days, 'reason', p_reason),
    auth.uid()
  );

  -- Create notification for seller
  INSERT INTO notifications (
    user_id, type, title, message, metadata
  ) VALUES (
    p_seller_id,
    'fraud_hold_applied',
    'Payout Hold Applied',
    'A hold has been placed on your earnings due to fraud concerns. Hold will be released in ' || p_hold_days || ' days.',
    jsonb_build_object('hold_amount', p_hold_amount, 'reason', p_reason, 'hold_until', (NOW() + INTERVAL '1 day' * p_hold_days))
  );

  RETURN jsonb_build_object(
    'success', true,
    'hold_amount', p_hold_amount,
    'hold_until', (NOW() + INTERVAL '1 day' * p_hold_days)
  );
END;
$$;

-- 11. Function to release fraud holds
CREATE OR REPLACE FUNCTION release_fraud_hold(p_seller_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hold_amount BIGINT;
  v_admin_check BOOLEAN;
BEGIN
  -- Check if user is admin/officer
  SELECT EXISTS(
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role IN ('admin', 'officer')
  ) INTO v_admin_check;

  IF NOT v_admin_check THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admins can release fraud holds');
  END IF;

  -- Get hold amount
  SELECT fraud_hold_coins INTO v_hold_amount
  FROM seller_balances
  WHERE seller_id = p_seller_id AND fraud_hold_coins > 0;

  IF NOT FOUND OR v_hold_amount = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active fraud hold found');
  END IF;

  -- Release fraud hold
  UPDATE seller_balances
  SET available_coins = available_coins + v_hold_amount,
      fraud_hold_coins = 0,
      fraud_hold_reason = NULL,
      fraud_hold_until = NULL,
      last_fraud_check = NOW(),
      updated_at = NOW()
  WHERE seller_id = p_seller_id;

  -- Log the release
  INSERT INTO seller_history (
    seller_id, event_type, event_subtype, severity, title, description,
    metadata, moderator_id
  ) VALUES (
    p_seller_id, 'fraud_hold', 'hold_released', 'low',
    'Fraud Hold Released',
    'Payout hold has been released, funds are now available',
    jsonb_build_object('released_amount', v_hold_amount),
    auth.uid()
  );

  -- Create notification for seller
  INSERT INTO notifications (
    user_id, type, title, message, metadata
  ) VALUES (
    p_seller_id,
    'fraud_hold_released',
    'Payout Hold Released',
    'Your payout hold has been released. ' || v_hold_amount || ' coins are now available for payout.',
    jsonb_build_object('released_amount', v_hold_amount)
  );

  RETURN jsonb_build_object(
    'success', true,
    'released_amount', v_hold_amount
  );
END;
$$;

-- 12. Function to automatically release expired fraud holds
CREATE OR REPLACE FUNCTION release_expired_fraud_holds()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_released_count INTEGER := 0;
  v_seller_record RECORD;
BEGIN
  -- Find and release expired holds
  FOR v_seller_record IN
    SELECT seller_id, fraud_hold_coins
    FROM seller_balances
    WHERE fraud_hold_coins > 0
    AND fraud_hold_until < NOW()
  LOOP
    -- Release the hold
    UPDATE seller_balances
    SET available_coins = available_coins + v_seller_record.fraud_hold_coins,
        fraud_hold_coins = 0,
        fraud_hold_reason = NULL,
        fraud_hold_until = NULL,
        updated_at = NOW()
    WHERE seller_id = v_seller_record.seller_id;

    -- Log the automatic release
    INSERT INTO seller_history (
      seller_id, event_type, event_subtype, severity, title, description,
      metadata
    ) VALUES (
      v_seller_record.seller_id, 'fraud_hold', 'auto_released', 'low',
      'Fraud Hold Auto-Released',
      'Payout hold automatically released after expiration',
      jsonb_build_object('released_amount', v_seller_record.fraud_hold_coins)
    );

    -- Create notification
    INSERT INTO notifications (
      user_id, type, title, message, metadata
    ) VALUES (
      v_seller_record.seller_id,
      'fraud_hold_released',
      'Payout Hold Released',
      'Your payout hold has expired and been automatically released. ' || v_seller_record.fraud_hold_coins || ' coins are now available.',
      jsonb_build_object('released_amount', v_seller_record.fraud_hold_coins)
    );

    v_released_count := v_released_count + 1;
  END LOOP;

  RETURN v_released_count;
END;
$$;

-- 13. View for active marketplace disputes (for admin dashboard)
CREATE OR REPLACE VIEW active_marketplace_disputes AS
SELECT
  md.*,
  mp.item_id,
  mi.title as item_title,
  buyer.username as buyer_username,
  seller.username as seller_username,
  EXTRACT(EPOCH FROM (md.arbitration_deadline - NOW())) / 86400 as days_until_deadline
FROM marketplace_disputes md
LEFT JOIN marketplace_purchases mp ON md.purchase_id = mp.id
LEFT JOIN marketplace_items mi ON mp.item_id = mi.id
LEFT JOIN user_profiles buyer ON md.buyer_id = buyer.id
LEFT JOIN user_profiles seller ON md.seller_id = seller.id
WHERE md.status IN ('pending', 'under_review', 'arbitration')
ORDER BY md.created_at ASC;

-- 14. View for sellers with fraud holds
CREATE OR REPLACE VIEW sellers_with_fraud_holds AS
SELECT
  sb.*,
  up.username,
  up.email,
  EXTRACT(EPOCH FROM (sb.fraud_hold_until - NOW())) / 86400 as days_until_release
FROM seller_balances sb
LEFT JOIN user_profiles up ON sb.seller_id = up.id
WHERE sb.fraud_hold_coins > 0
ORDER BY sb.fraud_hold_until ASC;

-- 15. Grant permissions
GRANT EXECUTE ON FUNCTION create_marketplace_dispute(UUID, VARCHAR(50), TEXT, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_marketplace_dispute(UUID, TEXT, BIGINT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION apply_fraud_hold(UUID, BIGINT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION release_fraud_hold(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION release_expired_fraud_holds() TO authenticated;

-- Grant select on views
GRANT SELECT ON active_marketplace_disputes TO authenticated;
GRANT SELECT ON sellers_with_fraud_holds TO authenticated;

-- 16. Add comments
COMMENT ON TABLE marketplace_disputes IS 'Marketplace purchase disputes requiring arbitration';
COMMENT ON TABLE dispute_arbitration_log IS 'Audit log of dispute arbitration actions';
COMMENT ON FUNCTION create_marketplace_dispute IS 'Allows buyers to file disputes for marketplace purchases';
COMMENT ON FUNCTION resolve_marketplace_dispute IS 'Allows admins to resolve marketplace disputes with refunds';
COMMENT ON FUNCTION apply_fraud_hold IS 'Places anti-fraud holds on seller payouts';
COMMENT ON FUNCTION release_fraud_hold IS 'Manually releases fraud holds on seller payouts';
COMMENT ON FUNCTION release_expired_fraud_holds IS 'Automatically releases expired fraud holds';
COMMENT ON VIEW active_marketplace_disputes IS 'Active marketplace disputes for admin review';
COMMENT ON VIEW sellers_with_fraud_holds IS 'Sellers currently under fraud hold';

-- 17. Create trigger to automatically release expired fraud holds (run daily)
-- This would be called by a scheduled job/cron, but we can create the function for manual execution