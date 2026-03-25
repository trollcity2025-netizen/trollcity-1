-- Marketplace Orders Enhancement
-- Adds order tracking, shipping, cancellation, and status management

-- 1. Add status and shipping fields to marketplace_purchases
ALTER TABLE marketplace_purchases ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded'));
ALTER TABLE marketplace_purchases ADD COLUMN IF NOT EXISTS shipping_carrier text;
ALTER TABLE marketplace_purchases ADD COLUMN IF NOT EXISTS tracking_number text;
ALTER TABLE marketplace_purchases ADD COLUMN IF NOT EXISTS tracking_url text;
ALTER TABLE marketplace_purchases ADD COLUMN IF NOT EXISTS shipped_at timestamptz;
ALTER TABLE marketplace_purchases ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
ALTER TABLE marketplace_purchases ADD COLUMN IF NOT EXISTS cancellation_requested_at timestamptz;
ALTER TABLE marketplace_purchases ADD COLUMN IF NOT EXISTS cancellation_reason text;
ALTER TABLE marketplace_purchases ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE marketplace_purchases ADD COLUMN IF NOT EXISTS refunded_at timestamptz;
ALTER TABLE marketplace_purchases ADD COLUMN IF NOT EXISTS shipping_address text;
ALTER TABLE marketplace_purchases ADD COLUMN IF NOT EXISTS shipping_city text;
ALTER TABLE marketplace_purchases ADD COLUMN IF NOT EXISTS shipping_state text;
ALTER TABLE marketplace_purchases ADD COLUMN IF NOT EXISTS shipping_zip text;
ALTER TABLE marketplace_purchases ADD COLUMN IF NOT EXISTS shipping_name text;

-- 2. Add shipping info to marketplace_items for physical items
ALTER TABLE marketplace_items ADD COLUMN IF NOT EXISTS requires_shipping boolean DEFAULT false;

-- 3. Create function to update order status
CREATE OR REPLACE FUNCTION update_marketplace_order_status(
  p_order_id uuid,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE marketplace_purchases
  SET status = p_status,
      cancelled_at = CASE WHEN p_status = 'cancelled' THEN now() ELSE cancelled_at END,
      refunded_at = CASE WHEN p_status = 'refunded' THEN now() ELSE refunded_at END
  WHERE id = p_order_id;
END;
$$;

-- 4. Create function to ship order with tracking
CREATE OR REPLACE FUNCTION ship_marketplace_order(
  p_order_id uuid,
  p_tracking_number text,
  p_carrier text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tracking_url text;
BEGIN
  -- Generate tracking URL based on carrier
  v_tracking_url := CASE 
    WHEN p_carrier = 'usps' THEN 'https://tools.usps.com/go/TrackConfirmAction?tLabels=' || p_tracking_number
    WHEN p_carrier = 'fedex' THEN 'https://www.fedex.com/fedextrack/?trknbr=' || p_tracking_number
    WHEN p_carrier = 'ups' THEN 'https://www.ups.com/track?tracknum=' || p_tracking_number
    ELSE NULL
  END;

  UPDATE marketplace_purchases
  SET status = 'shipped',
      tracking_number = p_tracking_number,
      shipping_carrier = p_carrier,
      tracking_url = v_tracking_url,
      shipped_at = now()
  WHERE id = p_order_id;
END;
$$;

-- 5. Create function to request cancellation (must be within 30 minutes)
CREATE OR REPLACE FUNCTION request_marketplace_cancellation(
  p_order_id uuid,
  p_reason text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_purchase marketplace_purchases%ROWTYPE;
  v_minutes_since_purchase int;
BEGIN
  -- Get the purchase record
  SELECT * INTO v_purchase FROM marketplace_purchases WHERE id = p_order_id;
  
  IF v_purchase IS NULL THEN
    RETURN 'Order not found';
  END IF;

  -- Check if already cancelled or refunded
  IF v_purchase.status IN ('cancelled', 'refunded') THEN
    RETURN 'Order already cancelled or refunded';
  END IF;

  -- Check if already shipped
  IF v_purchase.status = 'shipped' THEN
    RETURN 'Cannot cancel shipped order';
  END IF;

  -- Check 30 minute window
  v_minutes_since_purchase := EXTRACT(EPOCH FROM (now() - v_purchase.created_at)) / 60;
  IF v_minutes_since_purchase > 30 THEN
    RETURN 'Cancellation window expired (30 minutes)';
  END IF;

  -- Update the order
  UPDATE marketplace_purchases
  SET cancellation_requested_at = now(),
      cancellation_reason = p_reason,
      status = 'cancelled',
      cancelled_at = now()
  WHERE id = p_order_id;

  -- Refund the buyer (this would need additional logic to actually refund coins)
  -- The actual refund logic would be handled by the application

  RETURN 'Cancellation requested successfully';
END;
$$;

-- 6. Create function to refund order
CREATE OR REPLACE FUNCTION refund_marketplace_order(p_order_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_purchase marketplace_purchases%ROWTYPE;
BEGIN
  SELECT * INTO v_purchase FROM marketplace_purchases WHERE id = p_order_id;
  
  IF v_purchase IS NULL THEN
    RETURN 'Order not found';
  END IF;

  IF v_purchase.status IN ('cancelled', 'refunded') THEN
    RETURN 'Order already cancelled or refunded';
  END IF;

  UPDATE marketplace_purchases
  SET status = 'refunded',
      refunded_at = now()
  WHERE id = p_order_id;

  RETURN 'Order refunded successfully';
END;
$$;

-- 7. Enable RLS and create policies
ALTER TABLE marketplace_purchases ENABLE ROW LEVEL SECURITY;

-- Buyers can see their purchases
CREATE POLICY "Buyers can view their purchases" ON marketplace_purchases
  FOR SELECT USING (buyer_id = auth.uid());

-- Sellers can see their sales
CREATE POLICY "Sellers can view their sales" ON marketplace_purchases
  FOR SELECT USING (seller_id = auth.uid());

-- 8. Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_marketplace_purchases_buyer ON marketplace_purchases(buyer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_purchases_seller ON marketplace_purchases(seller_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_purchases_status ON marketplace_purchases(status);