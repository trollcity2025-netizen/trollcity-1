-- Wallets RLS policies to allow users to manage their own Trollmonds

-- Ensure RLS is enabled
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

-- Allow a user to view their own wallet row
CREATE POLICY "wallets_select_own" ON wallets
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow a user to insert their own wallet row
CREATE POLICY "wallets_insert_own" ON wallets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow a user to update their own wallet row (trollmonds, paid_coins, etc.)
CREATE POLICY "wallets_update_own" ON wallets
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

