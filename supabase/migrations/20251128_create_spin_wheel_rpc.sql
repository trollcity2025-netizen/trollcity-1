-- Create spin_wheel RPC function for Troll Wheel functionality

CREATE OR REPLACE FUNCTION spin_wheel(
  user_id UUID,
  cost INTEGER,
  prize_amount INTEGER,
  prize_type TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_profile RECORD;
  new_balance INTEGER;
  badge_value TEXT := NULL;
BEGIN
  -- Get current user profile
  SELECT * INTO user_profile
  FROM user_profiles
  WHERE id = user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'User not found');
  END IF;

  -- Check if user has enough coins
  IF (user_profile.free_coin_balance < cost) THEN
    RETURN json_build_object('error', 'Insufficient coins');
  END IF;

  -- Calculate new balance
  new_balance := user_profile.free_coin_balance - cost;

  -- Apply prize effects
  IF prize_type = 'coins' THEN
    new_balance := new_balance + prize_amount;
  ELSIF prize_type = 'vip' OR prize_type = 'bankrupt' THEN
    -- Bankrupt: lose all free coins
    new_balance := 0;
  ELSIF prize_type = 'jackpot' THEN
    -- Jackpot: award crown badge
    badge_value := 'troll_crown';
  END IF;

  -- Update user profile
  UPDATE user_profiles
  SET free_coin_balance = new_balance,
      badge = COALESCE(badge_value, badge),
      updated_at = NOW()
  WHERE id = user_id;

  -- Record coin transactions
  IF prize_type = 'coins' AND prize_amount > 0 THEN
    INSERT INTO coin_transactions (user_id, type, amount, description)
    VALUES (user_id, 'wheel_win', prize_amount, 'Wheel prize winnings');
  END IF;

  -- Record spin cost
  INSERT INTO coin_transactions (user_id, type, amount, description)
  VALUES (user_id, 'wheel_spin', -cost, 'Wheel spin cost');

  -- Record the spin
  INSERT INTO wheel_spins (user_id, prize_won, coins_spent, coins_won)
  VALUES (user_id, prize_type || ': ' || prize_amount, cost, CASE WHEN prize_type = 'coins' THEN prize_amount ELSE 0 END);

  -- Return updated profile data
  RETURN json_build_object(
    'free_coin_balance', new_balance,
    'badge', COALESCE(badge_value, user_profile.badge)
  );
END;
$$;