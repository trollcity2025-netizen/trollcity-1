-- Seller Payout System Implementation
-- This migration implements the seller payout logic using Troll Coins

-- 1. Add fulfillment status to marketplace_purchases
ALTER TABLE marketplace_purchases
ADD COLUMN IF NOT EXISTS fulfillment_status text DEFAULT 'pending' CHECK (fulfillment_status IN ('pending', 'fulfilled', 'cancelled')),
ADD COLUMN IF NOT EXISTS fulfilled_at timestamptz;

-- 2. Function to process marketplace purchase with seller payouts
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
  WHERE id = p_item_id AND status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Item not found or not available');
  END IF;

  -- Check if item has stock
  IF v_item.stock IS NOT NULL AND v_item.stock <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Item out of stock');
  END IF;

  v_seller_id := v_item.seller_id;
  v_purchase_price := v_item.price_coins;

  -- Calculate fees: 20% platform fee, 80% seller earnings
  v_platform_fee := (v_purchase_price * 20) / 100;
  v_seller_earnings := v_purchase_price - v_platform_fee;

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

-- 3. Function to fulfill marketplace orders (move pending to available coins)
CREATE OR REPLACE FUNCTION fulfill_marketplace_order(p_purchase_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchase RECORD;
  v_seller_earnings bigint;
BEGIN
  -- Get purchase details
  SELECT * INTO v_purchase
  FROM marketplace_purchases
  WHERE id = p_purchase_id AND fulfillment_status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Purchase not found or already fulfilled');
  END IF;

  v_seller_earnings := v_purchase.seller_earnings;

  -- Move pending coins to available
  UPDATE seller_balances
  SET available_coins = available_coins + v_seller_earnings,
      pending_coins = pending_coins - v_seller_earnings,
      updated_at = now()
  WHERE seller_id = v_purchase.seller_id;

  -- Update purchase status
  UPDATE marketplace_purchases
  SET fulfillment_status = 'fulfilled',
      fulfilled_at = now()
  WHERE id = p_purchase_id;

  -- Log transaction for seller
  INSERT INTO coin_transactions (
    user_id,
    type,
    coins,
    coin_type,
    description,
    metadata
  ) VALUES (
    v_purchase.seller_id,
    'seller_earnings',
    v_seller_earnings,
    'earned',
    'Marketplace sale earnings fulfilled',
    jsonb_build_object('purchase_id', p_purchase_id, 'item_id', v_purchase.item_id)
  );

  RETURN jsonb_build_object('success', true, 'earnings_transferred', v_seller_earnings);
END;
$$;

-- 4. Function for sellers to cash out available coins
CREATE OR REPLACE FUNCTION seller_cashout(
  p_seller_id uuid,
  p_amount bigint,
  p_payment_method text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available_coins bigint;
BEGIN
  -- Check available balance
  SELECT available_coins INTO v_available_coins
  FROM seller_balances
  WHERE seller_id = p_seller_id;

  IF v_available_coins < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient available coins');
  END IF;

  -- Deduct from available balance
  UPDATE seller_balances
  SET available_coins = available_coins - p_amount,
      updated_at = now()
  WHERE seller_id = p_seller_id;

  -- Create cashout request (assuming there's a cashout_requests table)
  -- This would need to be implemented based on existing cashout system

  RETURN jsonb_build_object('success', true, 'amount_requested', p_amount, 'payment_method', p_payment_method);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION process_marketplace_purchase(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION fulfill_marketplace_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION seller_cashout(uuid, bigint, text) TO authenticated;

-- Add comments
COMMENT ON FUNCTION process_marketplace_purchase IS 'Processes a marketplace purchase with 20% platform fee and 80% seller earnings to pending balance';
COMMENT ON FUNCTION fulfill_marketplace_order IS 'Fulfills a marketplace order by moving pending earnings to available balance';
COMMENT ON FUNCTION seller_cashout IS 'Allows sellers to cash out available coins';