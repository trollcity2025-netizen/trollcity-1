-- Marketplace Order Enhancement Migration
-- Adds: tracking, fulfillment, escrow/payout hold, appeals integration, troll court escalation
-- Run in Supabase SQL Editor

-- ==========================================
-- 1. ENHANCED ORDER STATUS & FULFILLMENT
-- ==========================================

-- Add new status values and columns to marketplace_purchases
ALTER TABLE marketplace_purchases ADD COLUMN IF NOT EXISTS fulfillment_status text 
  DEFAULT 'pending' 
  CHECK (fulfillment_status IN ('pending', 'awaiting_fulfillment', 'fulfilled', 'delivered', 'issue_reported', 'appeal_open', 'resolved', 'lawsuit_filed', 'cancelled', 'refunded'));

ALTER TABLE marketplace_purchases ADD COLUMN IF NOT EXISTS payout_status text 
  DEFAULT 'held' 
  CHECK (payout_status IN ('held', 'released', 'on_hold', 'refunded', 'cancelled'));

ALTER TABLE marketplace_purchases ADD COLUMN IF NOT EXISTS payout_released_at timestamptz;
ALTER TABLE marketplace_purchases ADD COLUMN IF NOT EXISTS payout_held_at timestamptz DEFAULT now();
ALTER TABLE marketplace_purchases ADD COLUMN IF NOT EXISTS payout_release_transaction_id uuid;

-- Link to appeals and troll court cases
ALTER TABLE marketplace_purchases ADD COLUMN IF NOT EXISTS appeal_id uuid REFERENCES transaction_appeals(id) ON DELETE SET NULL;
ALTER TABLE marketplace_purchases ADD COLUMN IF NOT EXISTS troll_court_case_id uuid REFERENCES troll_court_cases(id) ON DELETE SET NULL;

-- Tracking last updated for auto-refresh
ALTER TABLE marketplace_purchases ADD COLUMN IF NOT EXISTS tracking_last_updated_at timestamptz;
ALTER TABLE marketplace_purchases ADD COLUMN IF NOT EXISTS estimated_delivery_date timestamptz;

-- Seller input fields
ALTER TABLE marketplace_purchases ADD COLUMN IF NOT EXISTS shipped_date timestamptz;
ALTER TABLE marketplace_purchases ADD COLUMN IF NOT EXISTS carrier_tracking_status text;
ALTER TABLE marketplace_purchases ADD COLUMN IF NOT EXISTS tracking_error text;

-- Ensure tracking columns exist (may have been added in earlier migration)
ALTER TABLE marketplace_purchases ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE marketplace_purchases ADD COLUMN IF NOT EXISTS shipping_carrier text;
ALTER TABLE marketplace_purchases ADD COLUMN IF NOT EXISTS tracking_number text;
ALTER TABLE marketplace_purchases ADD COLUMN IF NOT EXISTS tracking_url text;
ALTER TABLE marketplace_purchases ADD COLUMN IF NOT EXISTS shipped_at timestamptz;
ALTER TABLE marketplace_purchases ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

-- Ensure financial columns exist
ALTER TABLE marketplace_purchases ADD COLUMN IF NOT EXISTS buyer_id uuid;
ALTER TABLE marketplace_purchases ADD COLUMN IF NOT EXISTS seller_id uuid;
ALTER TABLE marketplace_purchases ADD COLUMN IF NOT EXISTS item_id uuid;
ALTER TABLE marketplace_purchases ADD COLUMN IF NOT EXISTS price_paid bigint DEFAULT 0;
ALTER TABLE marketplace_purchases ADD COLUMN IF NOT EXISTS platform_fee bigint DEFAULT 0;
ALTER TABLE marketplace_purchases ADD COLUMN IF NOT EXISTS seller_earnings bigint DEFAULT 0;

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_mp_fulfillment_status ON marketplace_purchases(fulfillment_status);
CREATE INDEX IF NOT EXISTS idx_mp_payout_status ON marketplace_purchases(payout_status);
CREATE INDEX IF NOT EXISTS idx_mp_appeal_id ON marketplace_purchases(appeal_id);
CREATE INDEX IF NOT EXISTS idx_mp_troll_case_id ON marketplace_purchases(troll_court_case_id);
CREATE INDEX IF NOT EXISTS idx_mp_seller_payout ON marketplace_purchases(seller_id, payout_status);

-- ==========================================
-- 2. ORDER SHIPMENTS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS order_shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid REFERENCES marketplace_purchases(id) ON DELETE CASCADE NOT NULL,
  
  -- Carrier info
  carrier text NOT NULL CHECK (carrier IN ('usps', 'ups', 'fedex', 'dhl', 'other')),
  tracking_number text NOT NULL,
  tracking_url text,
  
  -- Internal status tracking
  tracking_status text DEFAULT 'pending' 
    CHECK (tracking_status IN ('pending', 'label_created', 'accepted', 'in_transit', 'out_for_delivery', 'delivered', 'exception', 'returned')),
  
  -- Carrier's raw status
  carrier_status text,
  carrier_error text,
  
  -- Timestamps
  shipped_date timestamptz,
  delivered_at timestamptz,
  tracking_last_updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Optional: reference to external tracking API response
  external_tracking_data jsonb,
  
  UNIQUE(order_id)
);

CREATE INDEX IF NOT EXISTS idx_shipments_order ON order_shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking_status ON order_shipments(tracking_status);
CREATE INDEX IF NOT EXISTS idx_shipments_carrier_tracking ON order_shipments(carrier, tracking_number);

-- ==========================================
-- 3. TRACKING EVENTS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS tracking_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid REFERENCES order_shipments(id) ON DELETE CASCADE NOT NULL,
  
  -- External event ID from carrier
  external_event_id text,
  
  -- Normalized status
  status text NOT NULL 
    CHECK (status IN ('label_created', 'accepted', 'in_transit', 'out_for_delivery', 'delivered', 'exception', 'returned')),
  
  -- Event details
  description text,
  location text,
  city text,
  state text,
  country text,
  zip_code text,
  
  -- Timestamps
  event_time timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  
  -- Raw carrier data for debugging
  raw_data jsonb
);

CREATE INDEX IF NOT EXISTS idx_tracking_events_shipment ON tracking_events(shipment_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_status ON tracking_events(status);
CREATE INDEX IF NOT EXISTS idx_tracking_events_time ON tracking_events(event_time DESC);

-- ==========================================
-- 4. PAYOUT HOLDS TABLE (Escrow)
-- ==========================================

CREATE TABLE IF NOT EXISTS marketplace_payout_holds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid REFERENCES marketplace_purchases(id) ON DELETE CASCADE NOT NULL,
  
  -- Amount being held
  amount bigint NOT NULL,
  
  -- Hold status
  status text DEFAULT 'active' CHECK (status IN ('active', 'released', 'refunded', 'cancelled', 'expired')),
  
  -- Release tracking
  released_at timestamptz,
  release_transaction_id uuid,
  released_by uuid REFERENCES user_profiles(id),
  
  -- Refund tracking
  refunded_at timestamptz,
  refund_transaction_id uuid,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Reason for hold/release
  hold_reason text DEFAULT 'awaiting_delivery',
  release_reason text,
  
  UNIQUE(order_id)
);

CREATE INDEX IF NOT EXISTS idx_payout_holds_order ON marketplace_payout_holds(order_id);
CREATE INDEX IF NOT EXISTS idx_payout_holds_status ON marketplace_payout_holds(status);
CREATE INDEX IF NOT EXISTS idx_payout_holds_seller ON marketplace_payout_holds(order_id, status);

-- ==========================================
-- 5. MARKETPLACE TYPE FOR TRACKING
-- ==========================================

DO $$ BEGIN
    CREATE TYPE tracking_event_status AS ENUM (
        'label_created', 
        'accepted', 
        'in_transit', 
        'out_for_delivery', 
        'delivered', 
        'exception', 
        'returned'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==========================================
-- 6. RLS POLICIES FOR NEW TABLES
-- ==========================================

-- Enable RLS on new tables
ALTER TABLE order_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_payout_holds ENABLE ROW LEVEL SECURITY;

-- Order Shipments Policies
-- Buyers and sellers can view shipment info
CREATE POLICY "Buyers can view their order shipments" ON order_shipments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM marketplace_purchases WHERE id = order_shipments.order_id AND buyer_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM marketplace_purchases WHERE id = order_shipments.order_id AND seller_id = auth.uid())
  );

-- Tracking Events Policies (same visibility)
CREATE POLICY "Buyers can view their tracking events" ON tracking_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM order_shipments 
      JOIN marketplace_purchases ON marketplace_purchases.id = order_shipments.order_id
      WHERE order_shipments.id = tracking_events.shipment_id 
        AND (marketplace_purchases.buyer_id = auth.uid() OR marketplace_purchases.seller_id = auth.uid())
    )
  );

-- Payout Holds - service role only
CREATE POLICY "Service role full access payout holds" ON marketplace_payout_holds
  FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- 7. HELPER FUNCTIONS
-- ==========================================

-- Function to create payout hold when order is placed
CREATE OR REPLACE FUNCTION create_marketplace_payout_hold(
  p_order_id uuid,
  p_amount bigint
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_hold_id uuid;
BEGIN
  -- Check if hold already exists
  SELECT id INTO v_hold_id FROM marketplace_payout_holds 
  WHERE order_id = p_order_id AND status = 'active';
  
  IF v_hold_id IS NOT NULL THEN
    RETURN v_hold_id; -- Already exists
  END IF;
  
  -- Create new hold
  INSERT INTO marketplace_payout_holds (order_id, amount, status, hold_reason)
  VALUES (p_order_id, p_amount, 'active', 'awaiting_delivery')
  RETURNING id INTO v_hold_id;
  
  -- Update order payout status
  UPDATE marketplace_purchases 
  SET payout_status = 'held', payout_held_at = now()
  WHERE id = p_order_id;
  
  RETURN v_hold_id;
END;
$$;

-- Function to release payout hold (called when carrier confirms delivery)
CREATE OR REPLACE FUNCTION release_marketplace_payout(
  p_order_id uuid,
  p_release_reason text DEFAULT 'delivered',
  p_released_by uuid DEFAULT null
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order marketplace_purchases%ROWTYPE;
  v_hold marketplace_payout_holds%ROWTYPE;
  v_seller_earnings bigint;
  v_release_tx_id uuid;
BEGIN
  -- Get the order
  SELECT * INTO v_order FROM marketplace_purchases WHERE id = p_order_id;
  
  IF v_order IS NULL THEN
    RETURN 'Order not found';
  END IF;
  
  -- Check if payout already released (idempotent)
  IF v_order.payout_status = 'released' THEN
    RETURN 'Payout already released';
  END IF;
  
  IF v_order.payout_status = 'refunded' THEN
    RETURN 'Payout already refunded';
  END IF;
  
  -- Get the hold record
  SELECT * INTO v_hold FROM marketplace_payout_holds 
  WHERE order_id = p_order_id AND status = 'active';
  
  IF v_hold IS NULL THEN
    RETURN 'No active payout hold found';
  END IF;
  
  -- Mark hold as released
  UPDATE marketplace_payout_holds
  SET status = 'released',
      released_at = now(),
      release_reason = p_release_reason,
      released_by = p_released_by,
      updated_at = now()
  WHERE id = v_hold.id;
  
  -- Mark order payout as released
  UPDATE marketplace_purchases
  SET payout_status = 'released',
      payout_released_at = now(),
      updated_at = now()
  WHERE id = p_order_id;
  
  RETURN 'Payout released successfully';
END;
$$;

-- Function to hold seller payout when appeal is opened
CREATE OR REPLACE FUNCTION hold_marketplace_payout_for_appeal(
  p_order_id uuid,
  p_appeal_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order marketplace_purchases%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM marketplace_purchases WHERE id = p_order_id;
  
  IF v_order IS NULL THEN
    RETURN 'Order not found';
  END IF;
  
  -- Link appeal to order
  UPDATE marketplace_purchases
  SET appeal_id = p_appeal_id,
      fulfillment_status = 'appeal_open',
      updated_at = now()
  WHERE id = p_order_id;
  
  -- If payout is still held, keep it on hold
  IF v_order.payout_status = 'held' THEN
    UPDATE marketplace_purchases
    SET payout_status = 'on_hold',
        updated_at = now()
    WHERE id = p_order_id;
    
    UPDATE marketplace_payout_holds
    SET hold_reason = 'appeal_pending',
        updated_at = now()
    WHERE order_id = p_order_id AND status = 'active';
  END IF;
  
  RETURN 'Payout held for appeal';
END;
$$;

-- Function to create marketplace appeal (links to existing transaction_appeals)
CREATE OR REPLACE FUNCTION create_marketplace_appeal(
  p_order_id uuid,
  p_user_id uuid,
  p_category text,
  p_description text,
  p_desired_resolution text DEFAULT null
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order marketplace_purchases%ROWTYPE;
  v_appeal_id uuid;
  v_appeal_category appeal_category;
BEGIN
  -- Get the order
  SELECT * INTO v_order FROM marketplace_purchases WHERE id = p_order_id;
  
  IF v_order IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  
  -- Map category to appeal_category type
  v_appeal_category := CASE p_category
    WHEN 'non_delivery' THEN 'non_delivery'::appeal_category
    WHEN 'not_as_described' THEN 'not_as_described'::appeal_category
    WHEN 'damaged_item' THEN 'damaged_item'::appeal_category
    WHEN 'seller_issue' THEN 'seller_issue'::appeal_category
    WHEN 'buyer_issue' THEN 'buyer_issue'::appeal_category
    WHEN 'payment_issue' THEN 'payment_issue'::appeal_category
    ELSE 'other'::appeal_category
  END;
  
  -- Create appeal in transaction_appeals table
  INSERT INTO transaction_appeals (
    user_id,
    order_id,
    category,
    description,
    desired_resolution,
    related_user_id,
    amount_in_dispute,
    escrow_release_status
  )
  VALUES (
    p_user_id,
    p_order_id,
    v_appeal_category,
    p_description,
    p_desired_resolution,
    v_order.seller_id,
    v_order.price_paid,
    'held'
  )
  RETURNING id INTO v_appeal_id;
  
  -- Update order with appeal link and hold payout if needed
  PERFORM hold_marketplace_payout_for_appeal(p_order_id, v_appeal_id);
  
  RETURN v_appeal_id;
END;
$$;

-- Function to escalate appeal to Troll Court
CREATE OR REPLACE FUNCTION escalate_to_troll_court(
  p_order_id uuid,
  p_plaintiff_id uuid,
  p_defendant_id uuid,
  p_description text,
  p_claim_amount bigint DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order marketplace_purchases%ROWTYPE;
  v_case_id uuid;
  v_appeal_id uuid;
BEGIN
  -- Get the order
  SELECT * INTO v_order FROM marketplace_purchases WHERE id = p_order_id;
  
  IF v_order IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  
  -- Get existing appeal if any
  SELECT appeal_id INTO v_appeal_id FROM marketplace_purchases WHERE id = p_order_id;
  
  -- Create Troll Court case
  INSERT INTO troll_court_cases (
    plaintiff_id,
    defendant_id,
    case_type,
    description,
    claim_amount,
    status,
    related_order_id
  )
  VALUES (
    p_plaintiff_id,
    p_defendant_id,
    'civil',
    p_description,
    p_claim_amount,
    'pending',
    p_order_id
  )
  RETURNING id INTO v_case_id;
  
  -- Link case to order
  UPDATE marketplace_purchases
  SET troll_court_case_id = v_case_id,
      fulfillment_status = 'lawsuit_filed',
      updated_at = now()
  WHERE id = p_order_id;
  
  -- If appeal exists, update its status to escalated
  IF v_appeal_id IS NOT NULL THEN
    UPDATE transaction_appeals
    SET status = 'escalated',
        updated_at = now()
    WHERE id = v_appeal_id;
  END IF;
  
  RETURN v_case_id;
END;
$$;

-- Function to fulfill order with tracking (enhanced version)
CREATE OR REPLACE FUNCTION fulfill_marketplace_order(
  p_order_id uuid,
  p_tracking_number text,
  p_carrier text,
  p_shipped_date timestamptz DEFAULT now()
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order marketplace_purchases%ROWTYPE;
  v_tracking_url text;
  v_shipment_id uuid;
BEGIN
  -- Get the order
  SELECT * INTO v_order FROM marketplace_purchases WHERE id = p_order_id;
  
  IF v_order IS NULL THEN
    RETURN 'Order not found';
  END IF;
  
  IF v_order.status NOT IN ('paid', 'processing') THEN
    RETURN 'Order cannot be fulfilled in current status';
  END IF;
  
  -- Generate tracking URL
  v_tracking_url := CASE 
    WHEN p_carrier = 'usps' THEN 'https://tools.usps.com/go/TrackConfirmAction?tLabels=' || p_tracking_number
    WHEN p_carrier = 'fedex' THEN 'https://www.fedex.com/fedextrack/?trknbr=' || p_tracking_number
    WHEN p_carrier = 'ups' THEN 'https://www.ups.com/track?tracknum=' || p_tracking_number
    WHEN p_carrier = 'dhl' THEN 'https://www.dhl.com/en/express/tracking.html?AWB=' || p_tracking_number
    ELSE NULL
  END;
  
  -- Upsert shipment record
  INSERT INTO order_shipments (order_id, carrier, tracking_number, tracking_url, tracking_status, shipped_date)
  VALUES (p_order_id, p_carrier, p_tracking_number, v_tracking_url, 'label_created', p_shipped_date)
  ON CONFLICT (order_id) DO UPDATE SET
    carrier = p_carrier,
    tracking_number = p_tracking_number,
    tracking_url = v_tracking_url,
    shipped_date = p_shipped_date,
    tracking_status = 'label_created',
    updated_at = now()
  RETURNING id INTO v_shipment_id;
  
  -- Update order
  UPDATE marketplace_purchases
  SET status = 'shipped',
      fulfillment_status = 'fulfilled',
      tracking_number = p_tracking_number,
      shipping_carrier = p_carrier,
      tracking_url = v_tracking_url,
      shipped_at = now(),
      shipped_date = p_shipped_date,
      updated_at = now()
  WHERE id = p_order_id;
  
  RETURN 'Order fulfilled successfully';
END;
$$;

-- Function to update tracking status from carrier webhook/polling
CREATE OR REPLACE FUNCTION update_tracking_status(
  p_carrier text,
  p_tracking_number text,
  p_status text,
  p_description text DEFAULT null,
  p_location text DEFAULT null,
  p_event_time timestamptz DEFAULT now()
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_shipment order_shipments%ROWTYPE;
  v_order marketplace_purchases%ROWTYPE;
  v_normalized_status tracking_event_status;
  v_event_id uuid;
BEGIN
  -- Find shipment by carrier and tracking number
  SELECT * INTO v_shipment 
  FROM order_shipments 
  WHERE carrier = p_carrier AND tracking_number = p_tracking_number;
  
  IF v_shipment IS NULL THEN
    RETURN 'Shipment not found';
  END IF;
  
  -- Normalize status
  v_normalized_status := CASE LOWER(p_status)
    WHEN 'label_created' THEN 'label_created'::tracking_event_status
    WHEN 'pre-shipment' THEN 'label_created'::tracking_event_status
    WHEN 'label created' THEN 'label_created'::tracking_event_status
    WHEN 'accepted' THEN 'accepted'::tracking_event_status
    WHEN 'picked up' THEN 'accepted'::tracking_event_status
    WHEN 'picked-up' THEN 'accepted'::tracking_event_status
    WHEN 'in possession' THEN 'accepted'::tracking_event_status
    WHEN 'in_transit' THEN 'in_transit'::tracking_event_status
    WHEN 'in transit' THEN 'in_transit'::tracking_event_status
    WHEN 'transit' THEN 'in_transit'::tracking_event_status
    WHEN 'departed' THEN 'in_transit'::tracking_event_status
    WHEN 'arrived' THEN 'in_transit'::tracking_event_status
    WHEN 'out_for_delivery' THEN 'out_for_delivery'::tracking_event_status
    WHEN 'out for delivery' THEN 'out_for_delivery'::tracking_event_status
    WHEN 'delivered' THEN 'delivered'::tracking_event_status
    WHEN 'delivery completed' THEN 'delivered'::tracking_event_status
    WHEN 'exception' THEN 'exception'::tracking_event_status
    WHEN 'delivery exception' THEN 'exception'::tracking_event_status
    WHEN 'error' THEN 'exception'::tracking_event_status
    WHEN 'failed' THEN 'exception'::tracking_event_status
    WHEN 'returned' THEN 'returned'::tracking_event_status
    WHEN 'returned to sender' THEN 'returned'::tracking_event_status
    WHEN 'return' THEN 'returned'::tracking_event_status
    ELSE 'in_transit'::tracking_event_status
  END;
  
  -- Insert tracking event
  INSERT INTO tracking_events (
    shipment_id,
    status,
    description,
    location,
    event_time
  )
  VALUES (
    v_shipment.id,
    v_normalized_status,
    p_description,
    p_location,
    p_event_time
  )
  RETURNING id INTO v_event_id;
  
  -- Update shipment status
  UPDATE order_shipments
  SET tracking_status = v_normalized_status,
      carrier_status = p_status,
      tracking_last_updated_at = now(),
      delivered_at = CASE WHEN v_normalized_status = 'delivered'::tracking_event_status THEN now() ELSE delivered_at END,
      updated_at = now()
  WHERE id = v_shipment.id;
  
  -- Get order
  SELECT * INTO v_order FROM marketplace_purchases WHERE id = v_shipment.order_id;
  
  -- Update order based on delivery status
  IF v_normalized_status = 'delivered'::tracking_event_status THEN
    UPDATE marketplace_purchases
    SET status = 'delivered',
        fulfillment_status = 'delivered',
        delivered_at = now(),
        tracking_last_updated_at = now(),
        updated_at = now()
    WHERE id = v_order.id;
    
    -- Release seller payout
    PERFORM release_marketplace_payout(v_order.id, 'carrier_confirmed_delivery');
    
    RETURN 'DELIVERED';
  ELSIF v_normalized_status = 'exception'::tracking_event_status THEN
    UPDATE marketplace_purchases
    SET carrier_tracking_status = 'exception',
        tracking_error = p_description,
        tracking_last_updated_at = now(),
        updated_at = now()
    WHERE id = v_order.id;
    
    RETURN 'EXCEPTION';
  ELSIF v_normalized_status = 'returned'::tracking_event_status THEN
    UPDATE marketplace_purchases
    SET status = 'returned',
        fulfillment_status = 'returned',
        tracking_last_updated_at = now(),
        updated_at = now()
    WHERE id = v_order.id;
    
    RETURN 'RETURNED';
  ELSE
    -- Update tracking status only
    UPDATE marketplace_purchases
    SET carrier_tracking_status = v_normalized_status::text,
        tracking_last_updated_at = now(),
        updated_at = now()
    WHERE id = v_order.id;
    
    RETURN 'UPDATED';
  END IF;
END;
$$;

-- ==========================================
-- 8. GRANT PERMISSIONS
-- ==========================================

GRANT ALL ON order_shipments TO service_role;
GRANT SELECT, INSERT, UPDATE ON order_shipments TO authenticated;

GRANT ALL ON tracking_events TO service_role;
GRANT SELECT ON tracking_events TO authenticated;

GRANT ALL ON marketplace_payout_holds TO service_role;
GRANT SELECT, INSERT, UPDATE ON marketplace_payout_holds TO authenticated;

GRANT EXECUTE ON FUNCTION create_marketplace_payout_hold(uuid, bigint) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION release_marketplace_payout(uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION hold_marketplace_payout_for_appeal(uuid, uuid) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION create_marketplace_appeal(uuid, uuid, text, text, text) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION escalate_to_troll_court(uuid, uuid, uuid, text, bigint) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION fulfill_marketplace_order(uuid, text, text, timestamptz) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION update_tracking_status(text, text, text, text, text, timestamptz) TO service_role;

-- Add order_shipments and tracking_events to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE order_shipments;
ALTER PUBLICATION supabase_realtime ADD TABLE tracking_events;
ALTER PUBLICATION supabase_realtime ADD TABLE marketplace_payout_holds;

-- ==========================================
-- 9. MIGRATE EXISTING ORDERS
-- ==========================================

-- Set initial payout hold for existing orders that are shipped/delivered
-- (Will be released when tracking webhook confirms delivery)
UPDATE marketplace_purchases 
SET payout_status = 'held', 
    payout_held_at = created_at,
    fulfillment_status = COALESCE(fulfillment_status, status::text)
WHERE status IN ('paid', 'processing', 'shipped', 'delivered', 'completed')
  AND payout_status IS NULL;

-- Update tracking_url for existing shipped orders
UPDATE marketplace_purchases mp
SET tracking_url = CASE 
    WHEN mp.shipping_carrier = 'usps' THEN 'https://tools.usps.com/go/TrackConfirmAction?tLabels=' || mp.tracking_number
    WHEN mp.shipping_carrier = 'fedex' THEN 'https://www.fedex.com/fedextrack/?trknbr=' || mp.tracking_number
    WHEN mp.shipping_carrier = 'ups' THEN 'https://www.ups.com/track?tracknum=' || mp.tracking_number
    ELSE mp.tracking_url
  END
WHERE mp.tracking_number IS NOT NULL 
  AND mp.tracking_url IS NULL;

-- Update order_shipments for existing orders with tracking
INSERT INTO order_shipments (order_id, carrier, tracking_number, tracking_url, tracking_status, shipped_date)
SELECT 
  mp.id,
  mp.shipping_carrier,
  mp.tracking_number,
  mp.tracking_url,
  CASE 
    WHEN mp.status = 'delivered' THEN 'delivered'
    WHEN mp.status = 'shipped' THEN 'in_transit'
    ELSE 'pending'
  END,
  mp.shipped_at
FROM marketplace_purchases mp
WHERE mp.tracking_number IS NOT NULL
ON CONFLICT (order_id) DO NOTHING;

-- Create payout holds for existing orders that have seller earnings pending
INSERT INTO marketplace_payout_holds (order_id, amount, status, hold_reason)
SELECT mp.id, mp.seller_earnings, 'active', 'awaiting_delivery'
FROM marketplace_purchases mp
WHERE mp.status IN ('paid', 'processing', 'shipped', 'delivered', 'completed')
  AND mp.seller_earnings > 0
  AND NOT EXISTS (SELECT 1 FROM marketplace_payout_holds mph WHERE mph.order_id = mp.id)
ON CONFLICT (order_id) DO NOTHING;

-- Mark orders that are already delivered as payout released
UPDATE marketplace_purchases 
SET payout_status = 'released', 
    payout_released_at = delivered_at
WHERE status = 'delivered' 
  AND payout_status = 'held';

UPDATE marketplace_payout_holds 
SET status = 'released', 
    released_at = mp.delivered_at,
    release_reason = 'previously_delivered'
FROM marketplace_purchases mp
WHERE marketplace_payout_holds.order_id = mp.id
  AND mp.status = 'delivered'
  AND marketplace_payout_holds.status = 'active';

-- ==========================================
-- 10. TRIGGER FOR UPDATED_AT
-- ==========================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_order_shipments_updated_at ON order_shipments;
CREATE TRIGGER trg_order_shipments_updated_at
  BEFORE UPDATE ON order_shipments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_marketplace_payout_holds_updated_at ON marketplace_payout_holds;
CREATE TRIGGER trg_marketplace_payout_holds_updated_at
  BEFORE UPDATE ON marketplace_payout_holds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ==========================================
-- DONE
-- ==========================================

SELECT 'Marketplace enhancement migration completed successfully!' as status;