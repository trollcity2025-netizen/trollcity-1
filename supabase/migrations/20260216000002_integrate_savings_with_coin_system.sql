-- Migration: Integrate Savings System with Coin Earning
-- This updates key coin-earning functions to use the savings deposit system

-- 1. Update coin approval function to use savings deposit
-- This function is used when manual coin orders are approved
DO $$
DECLARE
  v_function_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_schema = 'public' 
    AND routine_name = 'approve_manual_coin_order'
  ) INTO v_function_exists;
  
  IF v_function_exists THEN
    DROP FUNCTION IF EXISTS public.approve_manual_coin_order(UUID);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.approve_manual_coin_order(p_order_id UUID)
RETURNS TABLE(
  order_id UUID,
  user_id UUID,
  coins_awarded INTEGER,
  savings_added INTEGER,
  coin_balance INTEGER,
  savings_balance INTEGER
) AS $$
DECLARE
  v_order RECORD;
  v_balance INTEGER;
  v_savings_info RECORD;
BEGIN
  -- Get order
  SELECT * INTO v_order FROM public.manual_coin_orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  
  IF v_order.status != 'pending' THEN
    RAISE EXCEPTION 'Order is not pending';
  END IF;
  
  -- Use deposit_to_savings to handle coin split
  SELECT * INTO v_savings_info FROM deposit_to_savings(v_order.user_id, v_order.coins);
  
  -- Update order status
  UPDATE public.manual_coin_orders 
  SET status = 'approved', approved_at = NOW(), approved_by = auth.uid()
  WHERE id = p_order_id;
  
  -- Record transaction in coin_ledger
  INSERT INTO public.coin_ledger (user_id, type, amount, description, source, created_at)
  VALUES (
    v_order.user_id, 
    'manual_purchase', 
    v_order.coins, 
    'Manual coin purchase',
    'admin',
    NOW()
  );
  
  -- Return result
  RETURN QUERY SELECT
    p_order_id,
    v_order.user_id,
    v_order.coins,
    v_savings_info.savings_added,
    v_savings_info.new_coin_balance,
    v_savings_info.new_savings_balance;
END;
$$ LANGUAGE plpgsql;

-- 2. Create function to award coins from system (used for challenges, battles, etc)
CREATE OR REPLACE FUNCTION public.award_coins_to_user(
  p_user_id UUID,
  p_coins INTEGER,
  p_description TEXT DEFAULT 'Coin award'
)
RETURNS TABLE(
  coins_awarded INTEGER,
  savings_added INTEGER,
  new_coin_balance INTEGER,
  new_savings_balance INTEGER
) AS $$
DECLARE
  v_savings_info RECORD;
BEGIN
  IF p_coins <= 0 THEN
    RAISE EXCEPTION 'Coins must be positive';
  END IF;
  
  -- Use savings deposit system
  SELECT * INTO v_savings_info FROM deposit_to_savings(p_user_id, p_coins);
  
  -- Record in coin_ledger
  INSERT INTO public.coin_ledger (user_id, type, amount, description, source, created_at)
  VALUES (p_user_id, 'reward', p_coins, p_description, 'system', NOW());
  
  RETURN QUERY SELECT
    p_coins,
    v_savings_info.savings_added,
    v_savings_info.new_coin_balance,
    v_savings_info.new_savings_balance;
END;
$$ LANGUAGE plpgsql;

-- 3. Create function to add coins from gifts/tips during streams
CREATE OR REPLACE FUNCTION public.award_stream_gift_coins(
  p_user_id UUID,
  p_coins INTEGER,
  p_gift_name TEXT DEFAULT 'Gift'
)
RETURNS TABLE(
  coins_awarded INTEGER,
  savings_added INTEGER,
  new_coin_balance INTEGER,
  new_savings_balance INTEGER
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.award_coins_to_user(
    p_user_id,
    p_coins,
    'Gift received: ' || p_gift_name
  );
END;
$$ LANGUAGE plpgsql;

-- 4. Ensure wallets have savings_balance (safety check)
ALTER TABLE public.wallets
  ALTER COLUMN savings_balance SET DEFAULT 0;

-- 5. Grant execute permissions to these new functions
GRANT EXECUTE ON FUNCTION public.approve_manual_coin_order(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.award_coins_to_user(UUID, INTEGER, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.award_stream_gift_coins(UUID, INTEGER, TEXT) TO authenticated, anon;
