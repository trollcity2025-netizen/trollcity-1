-- Seller Contracts System (TrollTract-style)
-- Allows admins to create contracts that override default payout splits

-- 1. Create seller_contracts table
CREATE TABLE IF NOT EXISTS seller_contracts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    contract_name text NOT NULL,
    revenue_split_percentage integer NOT NULL CHECK (revenue_split_percentage BETWEEN 0 AND 100),
    bonus_multiplier numeric(3,2) DEFAULT 1.0 CHECK (bonus_multiplier >= 0.1 AND bonus_multiplier <= 5.0),
    start_date timestamptz NOT NULL,
    end_date timestamptz,
    status text DEFAULT 'active' CHECK (status IN ('active', 'paused', 'terminated', 'expired')),
    special_terms text,
    created_by uuid NOT NULL REFERENCES user_profiles(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),

    -- Ensure only one active contract per seller
    UNIQUE(seller_id, status) DEFERRABLE INITIALLY DEFERRED
);

-- 2. Add contract_id to seller_balances for tracking
ALTER TABLE seller_balances
ADD COLUMN IF NOT EXISTS active_contract_id uuid REFERENCES seller_contracts(id);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_seller_contracts_seller_id ON seller_contracts(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_contracts_status ON seller_contracts(status);
CREATE INDEX IF NOT EXISTS idx_seller_contracts_dates ON seller_contracts(start_date, end_date);

-- 4. Enable RLS
ALTER TABLE seller_contracts ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- Sellers can view their own contracts
CREATE POLICY "Sellers can view own contracts" ON seller_contracts
    FOR SELECT USING (seller_id = auth.uid());

-- Admins can manage all contracts
CREATE POLICY "Admins can manage contracts" ON seller_contracts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN ('admin', 'officer')
        )
    );

-- 6. Function to create seller contract
CREATE OR REPLACE FUNCTION create_seller_contract(
  p_seller_id uuid,
  p_contract_name text,
  p_revenue_split_percentage integer,
  p_bonus_multiplier numeric DEFAULT 1.0,
  p_start_date timestamptz,
  p_end_date timestamptz DEFAULT NULL,
  p_special_terms text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract_id uuid;
  v_admin_check boolean;
BEGIN
  -- Check if user is admin
  SELECT EXISTS(
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'officer')
  ) INTO v_admin_check;

  IF NOT v_admin_check THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admins can create contracts');
  END IF;

  -- Deactivate any existing active contract for this seller
  UPDATE seller_contracts
  SET status = 'terminated', updated_at = now()
  WHERE seller_id = p_seller_id AND status = 'active';

  -- Create new contract
  INSERT INTO seller_contracts (
    seller_id,
    contract_name,
    revenue_split_percentage,
    bonus_multiplier,
    start_date,
    end_date,
    special_terms,
    created_by
  ) VALUES (
    p_seller_id,
    p_contract_name,
    p_revenue_split_percentage,
    p_bonus_multiplier,
    p_start_date,
    p_end_date,
    p_special_terms,
    auth.uid()
  ) RETURNING id INTO v_contract_id;

  -- Update seller balance to reference active contract
  UPDATE seller_balances
  SET active_contract_id = v_contract_id, updated_at = now()
  WHERE seller_id = p_seller_id;

  RETURN jsonb_build_object('success', true, 'contract_id', v_contract_id);
END;
$$;

-- 7. Function to get active contract for seller
CREATE OR REPLACE FUNCTION get_active_seller_contract(p_seller_id uuid)
RETURNS seller_contracts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract seller_contracts;
BEGIN
  SELECT * INTO v_contract
  FROM seller_contracts
  WHERE seller_id = p_seller_id
    AND status = 'active'
    AND start_date <= now()
    AND (end_date IS NULL OR end_date > now())
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN v_contract;
END;
$$;

-- 8. Function to calculate seller earnings with contract override
CREATE OR REPLACE FUNCTION calculate_seller_earnings(
  p_seller_id uuid,
  p_sale_amount bigint
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract seller_contracts;
  v_default_platform_fee bigint;
  v_contract_earnings bigint;
BEGIN
  -- Get active contract if any
  SELECT * INTO v_contract FROM get_active_seller_contract(p_seller_id);

  IF v_contract.id IS NOT NULL THEN
    -- Use contract revenue split
    v_contract_earnings := (p_sale_amount * v_contract.revenue_split_percentage) / 100;
    -- Apply bonus multiplier
    v_contract_earnings := (v_contract_earnings * v_contract.bonus_multiplier)::bigint;
  ELSE
    -- Default: 80% to seller (20% platform fee)
    v_contract_earnings := (p_sale_amount * 80) / 100;
  END IF;

  RETURN v_contract_earnings;
END;
$$;

-- 9. Update process_marketplace_purchase to use contract-based earnings
CREATE OR REPLACE FUNCTION process_marketplace_purchase(
  p_buyer_id uuid,
  p_item_id uuid,
  p_payment_method text DEFAULT 'coins'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_seller_id uuid;
  v_purchase_price bigint;
  v_platform_fee bigint;
  v_seller_earnings bigint;
  v_purchase_id uuid;
  v_buyer_balance bigint;
BEGIN
  -- Get item details
  SELECT * INTO v_item
  FROM marketplace_items
  WHERE id = p_item_id AND status = 'active' AND moderation_status = 'approved';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Item not found or not available');
  END IF;

  -- Check if item has stock
  IF v_item.stock IS NOT NULL AND v_item.stock <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Item out of stock');
  END IF;

  v_seller_id := v_item.seller_id;
  v_purchase_price := v_item.price_coins;

  -- Calculate seller earnings using contract logic
  v_seller_earnings := calculate_seller_earnings(v_seller_id, v_purchase_price);
  v_platform_fee := v_purchase_price - v_seller_earnings;

  -- Check buyer balance
  SELECT paid_coin_balance + free_coin_balance INTO v_buyer_balance
  FROM user_profiles
  WHERE id = p_buyer_id;

  IF v_buyer_balance < v_purchase_price THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins');
  END IF;

  -- Deduct from buyer
  UPDATE user_profiles
  SET paid_coin_balance = CASE
        WHEN paid_coin_balance >= v_purchase_price THEN paid_coin_balance - v_purchase_price
        ELSE 0
      END,
      free_coin_balance = CASE
        WHEN paid_coin_balance >= v_purchase_price THEN free_coin_balance
        ELSE free_coin_balance - (v_purchase_price - paid_coin_balance)
      END,
      total_spent_coins = total_spent_coins + v_purchase_price,
      updated_at = now()
  WHERE id = p_buyer_id;

  -- Create purchase record
  INSERT INTO marketplace_purchases (
    buyer_id,
    seller_id,
    item_id,
    price_paid,
    platform_fee,
    seller_earnings,
    fulfillment_status
  ) VALUES (
    p_buyer_id,
    v_seller_id,
    p_item_id,
    v_purchase_price,
    v_platform_fee,
    v_seller_earnings,
    'pending'
  ) RETURNING id INTO v_purchase_id;

  -- Add to seller's pending balance
  INSERT INTO seller_balances (seller_id, pending_coins, total_earned_coins)
  VALUES (v_seller_id, v_seller_earnings, v_seller_earnings)
  ON CONFLICT (seller_id)
  DO UPDATE SET
    pending_coins = seller_balances.pending_coins + v_seller_earnings,
    total_earned_coins = seller_balances.total_earned_coins + v_seller_earnings,
    updated_at = now();

  -- Update item stock if applicable
  IF v_item.stock IS NOT NULL THEN
    UPDATE marketplace_items
    SET stock = stock - 1,
        status = CASE WHEN stock - 1 <= 0 THEN 'sold_out' ELSE status END
    WHERE id = p_item_id;
  END IF;

  -- Add to buyer inventory
  INSERT INTO user_inventory (user_id, item_id)
  VALUES (p_buyer_id, p_item_id);

  -- Log transaction
  INSERT INTO coin_transactions (
    user_id,
    type,
    coins,
    coin_type,
    description,
    metadata
  ) VALUES (
    p_buyer_id,
    'marketplace_purchase',
    -v_purchase_price,
    'mixed',
    'Purchased item from marketplace',
    jsonb_build_object('item_id', p_item_id, 'seller_id', v_seller_id, 'purchase_id', v_purchase_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'purchase_id', v_purchase_id,
    'seller_earnings', v_seller_earnings,
    'platform_fee', v_platform_fee
  );
END;
$$;

-- 10. Create updated_at trigger
CREATE OR REPLACE FUNCTION update_seller_contracts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_seller_contracts_updated_at
    BEFORE UPDATE ON seller_contracts
    FOR EACH ROW
    EXECUTE FUNCTION update_seller_contracts_updated_at();

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_seller_contract(uuid, text, integer, numeric, timestamptz, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_seller_contract(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_seller_earnings(uuid, bigint) TO authenticated;

-- Add comments
COMMENT ON TABLE seller_contracts IS 'TrollTract-style contracts that override default seller payout splits';
COMMENT ON FUNCTION create_seller_contract IS 'Creates a new seller contract (admin only)';
COMMENT ON FUNCTION get_active_seller_contract IS 'Gets the currently active contract for a seller';
COMMENT ON FUNCTION calculate_seller_earnings IS 'Calculates seller earnings considering active contracts';