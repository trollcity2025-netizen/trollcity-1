-- Marketplace RLS Policies
-- Run in Supabase SQL Editor

-- ==========================================
-- ORDER SHIPMENTS POLICIES
-- ==========================================

ALTER TABLE order_shipments ENABLE ROW LEVEL SECURITY;

-- Buyers can view their shipments
DROP POLICY IF EXISTS "Buyers can view their shipments" ON order_shipments;
CREATE POLICY "Buyers can view their shipments" ON order_shipments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM marketplace_purchases 
      WHERE id = order_shipments.order_id 
        AND buyer_id = auth.uid()
    )
  );

-- Sellers can view their shipments
DROP POLICY IF EXISTS "Sellers can view their shipments" ON order_shipments;
CREATE POLICY "Sellers can view their shipments" ON order_shipments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM marketplace_purchases 
      WHERE id = order_shipments.order_id 
        AND seller_id = auth.uid()
    )
  );

-- Service role can do everything
DROP POLICY IF EXISTS "Service role full access shipments" ON order_shipments;
CREATE POLICY "Service role full access shipments" ON order_shipments
  FOR ALL USING (auth.role() = 'service_role');

-- ==========================================
-- TRACKING EVENTS POLICIES
-- ==========================================

ALTER TABLE tracking_events ENABLE ROW LEVEL SECURITY;

-- Buyers can view their tracking events
DROP POLICY IF EXISTS "Buyers can view their tracking events" ON tracking_events;
CREATE POLICY "Buyers can view their tracking events" ON tracking_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM order_shipments os
      JOIN marketplace_purchases mp ON mp.id = os.order_id
      WHERE os.id = tracking_events.shipment_id
        AND mp.buyer_id = auth.uid()
    )
  );

-- Sellers can view their tracking events  
DROP POLICY IF EXISTS "Sellers can view their tracking events" ON tracking_events;
CREATE POLICY "Sellers can view their tracking events" ON tracking_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM order_shipments os
      JOIN marketplace_purchases mp ON mp.id = os.order_id
      WHERE os.id = tracking_events.shipment_id
        AND mp.seller_id = auth.uid()
    )
  );

-- Service role can do everything
DROP POLICY IF EXISTS "Service role full access tracking events" ON tracking_events;
CREATE POLICY "Service role full access tracking events" ON tracking_events
  FOR ALL USING (auth.role() = 'service_role');

-- ==========================================
-- MARKETPLACE PAYOUT HOLDS POLICIES
-- ==========================================

ALTER TABLE marketplace_payout_holds ENABLE ROW LEVEL SECURITY;

-- Buyers can view payout holds for their orders (for transparency)
DROP POLICY IF EXISTS "Buyers can view payout holds" ON marketplace_payout_holds;
CREATE POLICY "Buyers can view payout holds" ON marketplace_payout_holds
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM marketplace_purchases 
      WHERE id = marketplace_payout_holds.order_id 
        AND buyer_id = auth.uid()
    )
  );

-- Sellers can view their payout holds
DROP POLICY IF EXISTS "Sellers can view payout holds" ON marketplace_payout_holds;
CREATE POLICY "Sellers can view payout holds" ON marketplace_payout_holds
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM marketplace_purchases 
      WHERE id = marketplace_payout_holds.order_id 
        AND seller_id = auth.uid()
    )
  );

-- Service role can do everything
DROP POLICY IF EXISTS "Service role full access payout holds" ON marketplace_payout_holds;
CREATE POLICY "Service role full access payout holds" ON marketplace_payout_holds
  FOR ALL USING (auth.role() = 'service_role');

-- ==========================================
-- GRANT PERMISSIONS
-- ==========================================

-- Grant table access
GRANT SELECT ON order_shipments TO authenticated;
GRANT SELECT ON tracking_events TO authenticated;
GRANT SELECT ON marketplace_payout_holds TO authenticated;

GRANT ALL ON order_shipments TO service_role;
GRANT ALL ON tracking_events TO marketplace_payout_holds TO service_role;

-- Grant function execution
GRANT EXECUTE ON FUNCTION create_marketplace_payout_hold TO authenticated;
GRANT EXECUTE ON FUNCTION release_marketplace_payout TO service_role;
GRANT EXECUTE ON FUNCTION hold_marketplace_payout_for_appeal TO authenticated;
GRANT EXECUTE ON FUNCTION create_marketplace_appeal TO authenticated;
GRANT EXECUTE ON FUNCTION escalate_to_troll_court TO authenticated;
GRANT EXECUTE ON FUNCTION fulfill_marketplace_order TO authenticated;
GRANT EXECUTE ON FUNCTION update_tracking_status TO service_role;

SELECT 'Marketplace RLS policies created successfully!' as status;