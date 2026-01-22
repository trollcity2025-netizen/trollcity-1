-- Migration: Admin Pool V2 & Ledger System
-- Description: Adds tracking for platform liability, accurate user earnings, and atomic gift/cashout logic.

-- 1. Ensure admin_pool table exists and has tracking columns

-- Add user_id column to admin_pool for admin ownership
CREATE TABLE IF NOT EXISTS public.admin_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  trollcoins_balance NUMERIC(18,2) DEFAULT 0, -- Existing fee accumulator
  total_liability_coins BIGINT DEFAULT 0,     -- Unpaid user earnings
  total_liability_usd NUMERIC(18,2) DEFAULT 0, -- USD value of unpaid earnings
  total_paid_usd NUMERIC(18,2) DEFAULT 0,      -- Total cash successfully paid out
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initialize admin_pool row if not exists
-- Insert a default admin_pool row with a valid admin user_id if available
DO $$
DECLARE
  v_admin_id UUID;
BEGIN
  -- Only insert if a matching admin exists in both user_profiles and auth.users
  SELECT up.id INTO v_admin_id
  FROM public.user_profiles up
  JOIN auth.users au ON au.id = up.id
  WHERE up.role = 'admin'
  LIMIT 1;
  IF v_admin_id IS NOT NULL THEN
    INSERT INTO public.admin_pool (id, user_id, trollcoins_balance)
    SELECT v_admin_id, v_admin_id, 0
    WHERE NOT EXISTS (SELECT 1 FROM public.admin_pool);
  END IF;
END $$;

-- 2. Enhance user_profiles with explicit 'earned' balance
-- This separates "Spendable" (troll_coins) from "Cashable" (earned_balance)
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS earned_balance BIGINT DEFAULT 0 CHECK (earned_balance >= 0);

-- 3. Enhance admin_pool_ledger for detailed audit
-- Existing table in trollg.sql might be simple. We ensure it has what we need.
CREATE TABLE IF NOT EXISTS public.admin_pool_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount NUMERIC(18,3) NOT NULL,
  reason TEXT NOT NULL,
  ref_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add missing columns if table existed but was simple
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_pool_ledger' AND column_name = 'usd_value') THEN
    ALTER TABLE public.admin_pool_ledger ADD COLUMN usd_value NUMERIC(18,2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_pool_ledger' AND column_name = 'related_tx_id') THEN
    ALTER TABLE public.admin_pool_ledger ADD COLUMN related_tx_id UUID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_pool_ledger' AND column_name = 'snapshot_tier_rate') THEN
    ALTER TABLE public.admin_pool_ledger ADD COLUMN snapshot_tier_rate NUMERIC(18,4); -- Store conversion rate used
  END IF;
END $$;

-- 4. Helper Function: Calculate USD Value based on Tiers
-- 12,000 coins → $25
-- 30,000 coins → $70
-- 60,000 coins → $150
-- 120,000 coins → $325
CREATE OR REPLACE FUNCTION public.calculate_cashout_value(coins BIGINT)
RETURNS NUMERIC(18,2)
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
  IF coins >= 120000 THEN RETURN 325.00;
  ELSIF coins >= 60000 THEN RETURN 150.00;
  ELSIF coins >= 30000 THEN RETURN 70.00;
  ELSIF coins >= 12000 THEN RETURN 25.00;
  ELSE RETURN 0.00;
  END IF;
END;
$$;

-- 5. FUNCTION: send_gift_v2 (Atomic Gift Logic)
CREATE OR REPLACE FUNCTION public.send_gift_v2(
  p_sender_id UUID,
  p_receiver_id UUID,
  p_amount INT,
  p_gift_id UUID DEFAULT NULL, -- Optional, if linked to specific gift item
  p_description TEXT DEFAULT 'Gift'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender_balance BIGINT;
  v_admin_pool_id UUID;
  v_usd_value_change NUMERIC(18,2);
  v_new_liability BIGINT;
  v_tx_id UUID;
BEGIN
  -- 1. Check Sender Balance
  SELECT troll_coins INTO v_sender_balance FROM public.user_profiles WHERE id = p_sender_id;
  
  IF v_sender_balance IS NULL OR v_sender_balance < p_amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient funds');
  END IF;

  -- 2. Deduct from Sender
  UPDATE public.user_profiles
  SET troll_coins = troll_coins - p_amount,
      total_spent_coins = COALESCE(total_spent_coins, 0) + p_amount
  WHERE id = p_sender_id;

  -- 3. Credit Receiver (Both spendable AND earned)
  UPDATE public.user_profiles
  SET troll_coins = troll_coins + p_amount,
      earned_balance = COALESCE(earned_balance, 0) + p_amount,
      total_earned_coins = COALESCE(total_earned_coins, 0) + p_amount
  WHERE id = p_receiver_id;

  -- 4. Log User Transactions
  INSERT INTO public.coin_transactions (user_id, amount, type, description, metadata)
  VALUES (p_sender_id, -p_amount, 'gift_sent', p_description, json_build_object('receiver_id', p_receiver_id));

  INSERT INTO public.coin_transactions (user_id, amount, type, description, metadata)
  VALUES (p_receiver_id, p_amount, 'gift_received', p_description, json_build_object('sender_id', p_sender_id))
  RETURNING id INTO v_tx_id;

  -- 5. Update Admin Pool Liability
  -- We assume every earned coin has potential liability. 
  -- Note: Exact USD liability is hard to track perfectly per coin due to tiers, 
  -- so we track "Total Liability Coins" and estimate USD or update on cashout.
  -- Here we just track the coin liability.
  
  SELECT id INTO v_admin_pool_id FROM public.admin_pool LIMIT 1;
  
  UPDATE public.admin_pool
  SET total_liability_coins = total_liability_coins + p_amount,
      updated_at = NOW()
  WHERE id = v_admin_pool_id;

  -- 6. Log to Admin Ledger
  INSERT INTO public.admin_pool_ledger (amount, reason, ref_user_id, related_tx_id, usd_value)
  VALUES (p_amount, 'gift_liability_increase', p_receiver_id, v_tx_id, 0); -- USD value 0 for now, realized on cashout

  RETURN json_build_object('success', true, 'message', 'Gift sent successfully');
END;
$$;

-- 6. FUNCTION: request_cashout_v2 (Atomic Request)
CREATE OR REPLACE FUNCTION public.request_cashout_v2(
  p_user_id UUID,
  p_amount_coins INT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_record RECORD;
  v_cash_value NUMERIC(18,2);
  v_request_id UUID;
BEGIN
  -- 1. Validate User & Balances
  SELECT * INTO v_user_record FROM public.user_profiles WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Check against the SMALLER of spendable or earned balance
  -- This prevents cashing out coins that were already spent
  IF p_amount_coins > v_user_record.troll_coins OR p_amount_coins > v_user_record.earned_balance THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient eligible balance');
  END IF;

  -- 2. Calculate Cash Value (Tier Check)
  v_cash_value := public.calculate_cashout_value(p_amount_coins);
  
  IF v_cash_value <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid coin amount for cashout tier');
  END IF;

  -- 3. Deduct/Lock Coins Immediately
  -- We treat "Requested" as "Spent/Locked". If rejected, we must refund.
  UPDATE public.user_profiles
  SET troll_coins = troll_coins - p_amount_coins,
      earned_balance = earned_balance - p_amount_coins
  WHERE id = p_user_id;

  -- 4. Create Payout Request
  INSERT INTO public.payout_requests (
    user_id, 
    cash_amount, -- This column usually stores USD amount
    status,
    notes
  )
  VALUES (
    p_user_id,
    v_cash_value,
    'pending',
    'Coins locked: ' || p_amount_coins
  )
  RETURNING id INTO v_request_id;

  -- 5. Log Transaction
  INSERT INTO public.coin_transactions (user_id, amount, type, description, metadata)
  VALUES (p_user_id, -p_amount_coins, 'cashout_request', 'Cashout Request - Funds Locked', json_build_object('payout_request_id', v_request_id, 'usd_value', v_cash_value));

  RETURN json_build_object('success', true, 'request_id', v_request_id);
END;
$$;

-- 7. FUNCTION: approve_cashout_v2 (Admin Approval)
CREATE OR REPLACE FUNCTION public.approve_cashout_v2(
  p_request_id UUID,
  p_admin_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_req RECORD;
  v_coins_locked INT; -- Extracted from notes or we need a column. 
  -- NOTE: For safety, we should have stored 'coins_amount' in payout_requests. 
  -- Assuming we can parse it or added it. 
  -- For this V2, let's assume we parse it or rely on the USD value for admin pool tracking.
  -- Ideally we add 'coins_amount' to payout_requests. Let's do that safely.
  v_admin_pool_id UUID;
BEGIN
  -- Check Admin
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_admin_id AND (role = 'admin' OR is_admin = true)) THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT * INTO v_req FROM public.payout_requests WHERE id = p_request_id;
  
  IF v_req.status != 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'Request not pending');
  END IF;

  -- Mark Paid
  UPDATE public.payout_requests
  SET status = 'paid',
      processed_at = NOW(),
      admin_id = p_admin_id
  WHERE id = p_request_id;

  -- Update Admin Pool
  -- Reduce Liability (USD value is now paid)
  -- Increase Paid Total
  SELECT id INTO v_admin_pool_id FROM public.admin_pool LIMIT 1;

  UPDATE public.admin_pool
  SET total_paid_usd = total_paid_usd + v_req.cash_amount,
      -- We reduce liability by the coin amount? Or USD? 
      -- Since we track coin liability, we should reduce that too.
      -- But we didn't store coin amount cleanly.
      -- FIX: Extract from notes or rely on assumption. 
      -- For now, we update USD metrics.
      updated_at = NOW()
  WHERE id = v_admin_pool_id;

  -- Log Ledger
  INSERT INTO public.admin_pool_ledger (amount, reason, ref_user_id, related_tx_id, usd_value)
  VALUES (v_req.cash_amount, 'cashout_paid', v_req.user_id, p_request_id, v_req.cash_amount);

  RETURN json_build_object('success', true);
END;
$$;

-- Add coins_amount to payout_requests for better tracking if not exists
ALTER TABLE public.payout_requests ADD COLUMN IF NOT EXISTS coins_amount INT;

-- Update request_cashout_v2 to use the new column
CREATE OR REPLACE FUNCTION public.request_cashout_v2(
  p_user_id UUID,
  p_amount_coins INT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_record RECORD;
  v_cash_value NUMERIC(18,2);
  v_request_id UUID;
BEGIN
  SELECT * INTO v_user_record FROM public.user_profiles WHERE id = p_user_id;
  
  IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'User not found'); END IF;

  IF p_amount_coins > v_user_record.troll_coins OR p_amount_coins > v_user_record.earned_balance THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient eligible balance');
  END IF;

  v_cash_value := public.calculate_cashout_value(p_amount_coins);
  
  IF v_cash_value <= 0 THEN RETURN json_build_object('success', false, 'error', 'Invalid coin amount for cashout tier'); END IF;

  UPDATE public.user_profiles
  SET troll_coins = troll_coins - p_amount_coins,
      earned_balance = earned_balance - p_amount_coins
  WHERE id = p_user_id;

  INSERT INTO public.payout_requests (user_id, cash_amount, coins_amount, status)
  VALUES (p_user_id, v_cash_value, p_amount_coins, 'pending')
  RETURNING id INTO v_request_id;

  INSERT INTO public.coin_transactions (user_id, amount, type, description, metadata)
  VALUES (p_user_id, -p_amount_coins, 'cashout_request', 'Cashout Request', json_build_object('payout_request_id', v_request_id, 'usd_value', v_cash_value));

  -- Update Admin Pool Liability (Coins are now "Pending Payout" instead of "Unpaid Liability"?)
  -- Technically they are still liability until paid.
  -- But we might want to track "Pending" separate from "Unpaid".
  -- For now, we leave them in liability count until approved.

  RETURN json_build_object('success', true, 'request_id', v_request_id);
END;
$$;

-- Update approve_cashout_v2 to use new column
CREATE OR REPLACE FUNCTION public.approve_cashout_v2(
  p_request_id UUID,
  p_admin_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_req RECORD;
  v_admin_pool_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_admin_id AND (role = 'admin' OR is_admin = true)) THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT * INTO v_req FROM public.payout_requests WHERE id = p_request_id;
  
  IF v_req.status != 'pending' THEN RETURN json_build_object('success', false, 'error', 'Request not pending'); END IF;

  UPDATE public.payout_requests
  SET status = 'paid', processed_at = NOW(), admin_id = p_admin_id
  WHERE id = p_request_id;

  SELECT id INTO v_admin_pool_id FROM public.admin_pool LIMIT 1;

  UPDATE public.admin_pool
  SET total_paid_usd = total_paid_usd + v_req.cash_amount,
      total_liability_coins = total_liability_coins - COALESCE(v_req.coins_amount, 0), -- Reduce liability
      updated_at = NOW()
  WHERE id = v_admin_pool_id;

  INSERT INTO public.admin_pool_ledger (amount, reason, ref_user_id, related_tx_id, usd_value)
  VALUES (v_req.cash_amount, 'cashout_paid', v_req.user_id, p_request_id, v_req.cash_amount);

  RETURN json_build_object('success', true);
END;
$$;
