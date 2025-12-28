-- Migration for Trollmonds Store and Inventory
-- 1. Add currency column to gift_items
ALTER TABLE gift_items 
ADD COLUMN IF NOT EXISTS currency text DEFAULT 'paid' CHECK (currency IN ('paid', 'trollmonds'));

-- 2. Create user_inventory table
CREATE TABLE IF NOT EXISTS user_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES gift_items(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, item_id)
);

-- 3. RPC to purchase item with Trollmonds (adds to inventory)
CREATE OR REPLACE FUNCTION purchase_inventory_item(
  p_user_id uuid,
  p_item_id uuid,
  p_quantity integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_price bigint;
  v_item_currency text;
  v_total_cost bigint;
  v_balance bigint;
  v_inventory_id uuid;
  v_balance_column text;
  v_coin_type text;
BEGIN
  -- Get item details
  SELECT value, currency INTO v_item_price, v_item_currency
  FROM gift_items
  WHERE id = p_item_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Item not found');
  END IF;

  IF v_item_currency != 'trollmonds' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Trollmonds items can be purchased for inventory');
  END IF;

  v_total_cost := v_item_price * p_quantity;

  -- Detect which balance column exists on user_profiles
  SELECT column_name
  INTO v_balance_column
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'user_profiles'
    AND column_name IN ('trollmonds', 'free_coin_balance', 'troll_coins')
  ORDER BY CASE column_name
    WHEN 'trollmonds' THEN 1
    WHEN 'free_coin_balance' THEN 2
    ELSE 3
  END
  LIMIT 1;

  IF v_balance_column IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trollmonds balance column missing');
  END IF;

  v_coin_type := CASE v_balance_column
    WHEN 'trollmonds' THEN 'trollmonds'
    WHEN 'free_coin_balance' THEN 'free'
    ELSE 'troll_coins'
  END;

  EXECUTE format('SELECT COALESCE(%I, 0) FROM user_profiles WHERE id = $1', v_balance_column)
  INTO v_balance
  USING p_user_id;

  IF v_balance < v_total_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient Trollmonds');
  END IF;

  -- Deduct from the detected balance column
  EXECUTE format(
    'UPDATE user_profiles SET %1$I = %1$I - $1, updated_at = now() WHERE id = $2',
    v_balance_column
  )
  USING v_total_cost, p_user_id;

  v_balance := v_balance - v_total_cost;

  -- Add to inventory
  INSERT INTO user_inventory (user_id, item_id, quantity)
  VALUES (p_user_id, p_item_id, p_quantity)
  ON CONFLICT (user_id, item_id)
  DO UPDATE SET quantity = user_inventory.quantity + p_quantity, updated_at = now()
  RETURNING id INTO v_inventory_id;

  -- Log transaction
  INSERT INTO coin_transactions (
    user_id,
    type,
    coins,
    coin_type,
    description,
    metadata
  ) VALUES (
    p_user_id,
    'store_purchase',
    -v_total_cost,
    v_coin_type,
    'Purchased item from Trollmonds Store',
    jsonb_build_object('item_id', p_item_id, 'quantity', p_quantity)
  );

  RETURN jsonb_build_object('success', true, 'inventory_id', v_inventory_id, 'new_balance', v_balance);
END;
$$;

GRANT EXECUTE ON FUNCTION purchase_inventory_item(uuid, uuid, integer) TO authenticated;

-- 4. Seed some Trollmonds gifts
INSERT INTO gift_items (name, icon, value, currency, category, description) VALUES
  ('Troll Cookie', '🍪', 10, 'trollmonds', 'Small Gifts', 'A small snack for a troll'),
  ('High Five', '✋', 15, 'trollmonds', 'Small Gifts', 'Virtual high five'),
  ('Confetti', '🎊', 25, 'trollmonds', 'Fun Animations', 'Party time!'),
  ('Cool Shades', '😎', 30, 'trollmonds', 'Chat Stickers', 'Deal with it'),
  ('Troll Laugh', '😆', 40, 'trollmonds', 'Chat Stickers', 'Classic troll laugh'),
  ('Mini Sparkle', '✨', 50, 'trollmonds', 'Mini Effects', 'Shiny!')
ON CONFLICT DO NOTHING;
