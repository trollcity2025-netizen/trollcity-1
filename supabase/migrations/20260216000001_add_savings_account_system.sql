-- Migration: Add Savings Account System
-- Automatically moves 5 out of every coins received into savings
-- Savings can be used for cashouts and loan payments

-- 1. Add savings_balance column to wallets table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallets' AND column_name = 'savings_balance') THEN
    ALTER TABLE "public"."wallets" ADD COLUMN "savings_balance" INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 2. Create savings_ledger table to track savings transactions
CREATE TABLE IF NOT EXISTS "public"."savings_ledger" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal', 'cashout', 'loan_payment')),
  amount INTEGER NOT NULL,
  description TEXT,
  reference_id UUID,
  reference_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 3. Create index on savings_ledger for quick lookups
CREATE INDEX IF NOT EXISTS savings_ledger_user_id_idx ON "public"."savings_ledger"(user_id);
CREATE INDEX IF NOT EXISTS savings_ledger_created_at_idx ON "public"."savings_ledger"(created_at DESC);

-- 4. Create function to transfer coins to savings
-- This should be called when any coins are received
CREATE OR REPLACE FUNCTION public.deposit_to_savings(p_user_id UUID, p_coins_received INTEGER)
RETURNS TABLE(savings_added INTEGER, new_savings_balance INTEGER, new_coin_balance INTEGER) AS $$
DECLARE
  v_savings_to_add INTEGER;
BEGIN
  -- Calculate how much goes to savings (5 out of every coins received)
  v_savings_to_add := (p_coins_received / 5);
  
  IF v_savings_to_add > 0 THEN
    -- Update wallets: add to savings, keep the rest in coins
    UPDATE "public"."wallets"
    SET 
      savings_balance = savings_balance + v_savings_to_add,
      coin_balance = coin_balance + (p_coins_received - v_savings_to_add)
    WHERE user_id = p_user_id;
    
    -- Log to savings ledger
    INSERT INTO "public"."savings_ledger" (user_id, transaction_type, amount, description)
    VALUES (p_user_id, 'deposit', v_savings_to_add, 'Automatic savings deposit from coin receipt');
  ELSE
    -- If less than 5 coins received, all go to coin_balance
    UPDATE "public"."wallets"
    SET coin_balance = coin_balance + p_coins_received
    WHERE user_id = p_user_id;
  END IF;
  
  -- Return the result
  RETURN QUERY
  SELECT v_savings_to_add, 
         (SELECT savings_balance FROM "public"."wallets" WHERE user_id = p_user_id),
         (SELECT coin_balance FROM "public"."wallets" WHERE user_id = p_user_id);
END;
$$ LANGUAGE plpgsql;

-- 5. Create function to withdraw from savings for cashout
CREATE OR REPLACE FUNCTION public.withdraw_savings_for_cashout(p_user_id UUID, p_amount INTEGER)
RETURNS TABLE(success BOOLEAN, new_savings_balance INTEGER, message TEXT) AS $$
DECLARE
  v_current_savings INTEGER;
BEGIN
  -- Get current savings balance
  SELECT savings_balance INTO v_current_savings FROM "public"."wallets" WHERE user_id = p_user_id;
  
  IF v_current_savings IS NULL THEN
    RETURN QUERY SELECT FALSE, 0::INTEGER, 'User wallet not found'::TEXT;
    RETURN;
  END IF;
  
  IF v_current_savings < p_amount THEN
    RETURN QUERY SELECT FALSE, v_current_savings, 'Insufficient savings balance'::TEXT;
    RETURN;
  END IF;
  
  -- Deduct from savings
  UPDATE "public"."wallets"
  SET savings_balance = savings_balance - p_amount
  WHERE user_id = p_user_id;
  
  -- Log to savings ledger
  INSERT INTO "public"."savings_ledger" (user_id, transaction_type, amount, description)
  VALUES (p_user_id, 'cashout', p_amount, 'Cashout from savings');
  
  RETURN QUERY
  SELECT TRUE, 
         (SELECT savings_balance FROM "public"."wallets" WHERE user_id = p_user_id),
         'Successfully withdrawn from savings'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 6. Create function to withdraw from savings for loan payment
CREATE OR REPLACE FUNCTION public.use_savings_for_loan_payment(p_user_id UUID, p_amount INTEGER, p_loan_id UUID)
RETURNS TABLE(success BOOLEAN, new_savings_balance INTEGER, message TEXT) AS $$
DECLARE
  v_current_savings INTEGER;
BEGIN
  -- Get current savings balance
  SELECT savings_balance INTO v_current_savings FROM "public"."wallets" WHERE user_id = p_user_id;
  
  IF v_current_savings IS NULL THEN
    RETURN QUERY SELECT FALSE, 0::INTEGER, 'User wallet not found'::TEXT;
    RETURN;
  END IF;
  
  IF v_current_savings < p_amount THEN
    RETURN QUERY SELECT FALSE, v_current_savings, 'Insufficient savings to cover loan payment'::TEXT;
    RETURN;
  END IF;
  
  -- Deduct from savings
  UPDATE "public"."wallets"
  SET savings_balance = savings_balance - p_amount
  WHERE user_id = p_user_id;
  
  -- Log to savings ledger with loan reference
  INSERT INTO "public"."savings_ledger" (user_id, transaction_type, amount, description, reference_id, reference_type)
  VALUES (p_user_id, 'loan_payment', p_amount, 'Loan payment from savings', p_loan_id, 'loan');
  
  RETURN QUERY
  SELECT TRUE, 
         (SELECT savings_balance FROM "public"."wallets" WHERE user_id = p_user_id),
         'Successfully paid loan with savings'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 7. Create function to get savings details for a user
CREATE OR REPLACE FUNCTION public.get_savings_details(p_user_id UUID)
RETURNS TABLE(
  savings_balance INTEGER,
  coin_balance INTEGER,
  total_balance INTEGER,
  savings_percentage DECIMAL,
  recent_transactions JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    w.savings_balance,
    w.coin_balance,
    (w.savings_balance + w.coin_balance)::INTEGER,
    CASE 
      WHEN (w.savings_balance + w.coin_balance) > 0 
      THEN ROUND((w.savings_balance::DECIMAL / (w.savings_balance + w.coin_balance)) * 100, 2)
      ELSE 0
    END,
    COALESCE(
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'id', sl.id,
          'type', sl.transaction_type,
          'amount', sl.amount,
          'description', sl.description,
          'created_at', sl.created_at
        ) ORDER BY sl.created_at DESC
      ) FILTER (WHERE sl.id IS NOT NULL),
      '[]'::JSONB
    )
  FROM "public"."wallets" w
  LEFT JOIN "public"."savings_ledger" sl ON w.user_id = sl.user_id AND sl.created_at > NOW() - INTERVAL '30 days'
  WHERE w.user_id = p_user_id
  GROUP BY w.user_id, w.savings_balance, w.coin_balance;
END;
$$ LANGUAGE plpgsql;

-- 8. Add RLS policies for savings_ledger
ALTER TABLE "public"."savings_ledger" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own savings ledger"
  ON "public"."savings_ledger"
  FOR SELECT
  USING (auth.uid() = user_id);

-- 9. Grant functions to authenticated users
GRANT EXECUTE ON FUNCTION public.deposit_to_savings(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_savings_for_cashout(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.use_savings_for_loan_payment(UUID, INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_savings_details(UUID) TO authenticated;
