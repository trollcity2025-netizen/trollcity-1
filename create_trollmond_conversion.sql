-- Add trollmond_balance column to user_profiles if not exists (for future use)
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS trollmond_balance BIGINT DEFAULT 0;

-- Create trollmond_transactions table if not exists
CREATE TABLE IF NOT EXISTS trollmond_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id),
  type TEXT CHECK (type IN ('convert','burn','reward','expire')),
  paid_coins_spent INTEGER,
  trollmonds_added BIGINT,
  created_at TIMESTAMP DEFAULT now()
);

-- Create the RPC function for conversion
CREATE OR REPLACE FUNCTION convert_paid_coins_to_trollmonds(p_user_id UUID, p_paid_coins INTEGER)
RETURNS JSON AS $$
DECLARE
  user_record RECORD;
  trollmonds_to_add BIGINT;
BEGIN
  -- Validate input
  IF p_paid_coins <= 0 OR p_paid_coins % 100 != 0 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid conversion amount. Must be multiples of 100.');
  END IF;

  -- Get user record
  SELECT * INTO user_record FROM user_profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found.');
  END IF;

  -- Check balance
  IF (user_record.paid_coin_balance < p_paid_coins) THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient paid coins.');
  END IF;

  -- Calculate trollmonds
  trollmonds_to_add := p_paid_coins * 100;

  -- Atomic update (using free_coin_balance as trollmonds)
  UPDATE user_profiles
  SET
    paid_coin_balance = paid_coin_balance - p_paid_coins,
    free_coin_balance = free_coin_balance + trollmonds_to_add
  WHERE id = p_user_id;

  -- Log transaction
  INSERT INTO trollmond_transactions (user_id, type, paid_coins_spent, trollmonds_added)
  VALUES (p_user_id, 'convert', p_paid_coins, trollmonds_to_add);

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;