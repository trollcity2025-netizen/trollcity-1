
-- Migration to support Admin Manual Orders, Support Tickets, and Applications via RPCs
-- Replaces usage of Edge Functions and direct table updates with secure RPCs

-- ============================================================================
-- 1. Manual Coin Orders
-- ============================================================================

-- Wrapper function to approve/fulfill a manual order directly from client
DROP FUNCTION IF EXISTS process_manual_coin_order(UUID, TEXT);
CREATE OR REPLACE FUNCTION process_manual_coin_order(
  p_order_id UUID,
  p_external_tx_id TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_admin_id UUID;
  v_order RECORD;
  v_user_id UUID;
  v_coins INTEGER;
  v_amount_cents INTEGER;
BEGIN
  -- 1. Permission Check
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;

  v_admin_id := auth.uid();

  -- 2. Get Order
  SELECT * INTO v_order FROM manual_coin_orders WHERE id = p_order_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF v_order.status = 'fulfilled' OR v_order.status = 'paid' THEN
    RETURN json_build_object('success', false, 'error', 'Order already processed');
  END IF;

  v_user_id := v_order.user_id;
  v_coins := v_order.coins;
  v_amount_cents := v_order.amount_cents;

  -- 3. Update Order Status
  UPDATE manual_coin_orders
  SET status = 'fulfilled',
      paid_at = NOW(),
      fulfilled_at = NOW(),
      external_tx_id = COALESCE(p_external_tx_id, external_tx_id),
      processed_by = v_admin_id -- Ensure this column exists or add it
  WHERE id = p_order_id;

  -- 4. Credit Coins to User Profile
  UPDATE user_profiles
  SET troll_coins = troll_coins + v_coins,
      paid_coins = paid_coins + v_coins, -- Track purchased coins separately if needed
      total_earned_coins = total_earned_coins + v_coins,
      updated_at = NOW()
  WHERE id = v_user_id;

  -- 5. Create Coin Transaction Record
  INSERT INTO coin_transactions (
    user_id, 
    amount, 
    type, 
    description, 
    metadata
  ) VALUES (
    v_user_id,
    v_coins,
    'purchase', -- or 'manual_purchase'
    'Manual Coin Order Fulfilled',
    jsonb_build_object(
      'order_id', p_order_id, 
      'admin_id', v_admin_id,
      'amount_cents', v_amount_cents,
      'external_tx_id', p_external_tx_id
    )
  );

  -- 6. Notify User
  INSERT INTO notifications (user_id, type, title, message, metadata)
  VALUES (
    v_user_id, 
    'system', 
    'Coins Received!', 
    'Your manual coin order has been processed. ' || v_coins || ' coins have been added to your balance.',
    jsonb_build_object('order_id', p_order_id)
  );

  RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- 2. Support Tickets
-- ============================================================================

-- Function to resolve a ticket with a response
CREATE OR REPLACE FUNCTION resolve_support_ticket(
  p_ticket_id UUID,
  p_response TEXT
) RETURNS VOID AS $$
DECLARE
  v_ticket_user_id UUID;
  v_ticket_subject TEXT;
BEGIN
  -- 1. Permission Check
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;

  -- 2. Get Ticket Info
  SELECT user_id, subject INTO v_ticket_user_id, v_ticket_subject 
  FROM support_tickets WHERE id = p_ticket_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  -- 3. Update Ticket
  UPDATE support_tickets
  SET status = 'resolved',
      admin_response = p_response,
      admin_id = auth.uid(), -- Store the real admin ID
      response_at = NOW(),
      updated_at = NOW()
  WHERE id = p_ticket_id;

  -- 4. Notify User
  INSERT INTO notifications (user_id, type, title, message, metadata)
  VALUES (
    v_ticket_user_id, 
    'support_reply', 
    'Support Ticket Updated', 
    'Admin has replied to your ticket: ' || v_ticket_subject,
    jsonb_build_object('ticket_id', p_ticket_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to delete a ticket
CREATE OR REPLACE FUNCTION delete_support_ticket(p_ticket_id UUID)
RETURNS VOID AS $$
BEGIN
  -- 1. Permission Check
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;

  DELETE FROM support_tickets WHERE id = p_ticket_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure processed_by exists on manual_coin_orders if not already
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'manual_coin_orders' AND column_name = 'processed_by') THEN
    ALTER TABLE manual_coin_orders ADD COLUMN processed_by UUID REFERENCES user_profiles(id);
  END IF;
END $$;


-- ============================================================================
-- 3. Applications (Officer & General)
-- ============================================================================

-- Approve Officer Application (Sets Role + Updates App)
DROP FUNCTION IF EXISTS approve_officer_application(UUID);
CREATE OR REPLACE FUNCTION approve_officer_application(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_app_id UUID;
BEGIN
  -- Permission check handled by RLS/Security Definier (assuming admin calls this)
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;

  -- Find pending application
  SELECT id INTO v_app_id FROM applications WHERE user_id = p_user_id AND type = 'troll_officer' AND status = 'pending';
  
  -- Update user role
  UPDATE user_profiles 
  SET role = 'troll_officer',
      is_troll_officer = true,
      is_officer_active = true,
      updated_at = NOW()
  WHERE id = p_user_id;

  -- Update application if exists
  IF v_app_id IS NOT NULL THEN
    UPDATE applications SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = NOW() WHERE id = v_app_id;
  END IF;

  -- Notification
  INSERT INTO notifications (user_id, type, title, message)
  VALUES (p_user_id, 'application_result', 'Officer Application Approved', 'Welcome to the force! You are now a Troll Officer.');

  RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Approve Lead Officer Application
DROP FUNCTION IF EXISTS approve_lead_officer_application(UUID, UUID);
CREATE OR REPLACE FUNCTION approve_lead_officer_application(p_application_id UUID, p_reviewer_id UUID)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;

  SELECT user_id INTO v_user_id FROM applications WHERE id = p_application_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Application not found');
  END IF;

  -- Update User Role
  UPDATE user_profiles
  SET role = 'lead_officer',
      is_lead_officer = true,
      is_officer_active = true,
      updated_at = NOW()
  WHERE id = v_user_id;

  -- Update Application
  UPDATE applications
  SET status = 'approved',
      reviewed_by = p_reviewer_id,
      reviewed_at = NOW()
  WHERE id = p_application_id;

  -- Notification
  INSERT INTO notifications (user_id, type, title, message)
  VALUES (v_user_id, 'application_result', 'Lead Officer Application Approved', 'Congratulations! You have been promoted to Lead Officer.');

  RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Deny Application (Generic)
DROP FUNCTION IF EXISTS deny_application(UUID, UUID, TEXT);
CREATE OR REPLACE FUNCTION deny_application(p_app_id UUID, p_reviewer_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_type TEXT;
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;

  SELECT user_id, type INTO v_user_id, v_type FROM applications WHERE id = p_app_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Application not found');
  END IF;

  UPDATE applications
  SET status = 'rejected',
      reviewed_by = p_reviewer_id,
      reviewed_at = NOW(),
      notes = p_reason
  WHERE id = p_app_id;

  -- Notification
  INSERT INTO notifications (user_id, type, title, message)
  VALUES (v_user_id, 'application_result', 'Application Denied', 'Your application for ' || v_type || ' has been denied. Reason: ' || COALESCE(p_reason, 'No reason provided.'));

  RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- General Approve Application Dispatcher
DROP FUNCTION IF EXISTS approve_application(UUID, UUID);
CREATE OR REPLACE FUNCTION approve_application(p_app_id UUID, p_reviewer_id UUID)
RETURNS JSON AS $$
DECLARE
  v_type TEXT;
  v_user_id UUID;
BEGIN
  -- Permission check
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;

  SELECT type, user_id INTO v_type, v_user_id FROM applications WHERE id = p_app_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Application not found');
  END IF;

  IF v_type = 'seller' THEN
    -- Delegate to seller specific logic
    RETURN approve_seller_application(p_app_id, p_reviewer_id);
  ELSIF v_type = 'troll_officer' THEN
    -- Delegate to officer specific logic
    RETURN approve_officer_application(v_user_id);
  ELSIF v_type = 'lead_officer' THEN
    RETURN approve_lead_officer_application(p_app_id, p_reviewer_id);
  ELSE
    -- Generic approval
    UPDATE applications 
    SET status = 'approved', 
        reviewed_by = p_reviewer_id, 
        reviewed_at = NOW() 
    WHERE id = p_app_id;
    
    -- Generic Notification
    INSERT INTO notifications (user_id, type, title, message)
    VALUES (v_user_id, 'application_result', 'Application Approved', 'Your application for ' || v_type || ' has been approved.');

    RETURN json_build_object('success', true);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
