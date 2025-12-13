-- Create home_feature_cycles table if not exists
CREATE TABLE IF NOT EXISTS home_feature_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  total_spent_coins BIGINT DEFAULT 0,
  reward_paid BOOLEAN DEFAULT false,
  winner_user_id UUID REFERENCES user_profiles(id),
  created_at TIMESTAMP DEFAULT now()
);

-- Create home_feature_spend table if not exists
CREATE TABLE IF NOT EXISTS home_feature_spend (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID REFERENCES home_feature_cycles(id),
  user_id UUID REFERENCES user_profiles(id),
  coins_spent BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- Function to get or create active cycle
CREATE OR REPLACE FUNCTION get_or_create_active_cycle()
RETURNS UUID AS $$
DECLARE
  active_cycle_id UUID;
BEGIN
  -- Find active cycle (end_time > now)
  SELECT id INTO active_cycle_id
  FROM home_feature_cycles
  WHERE end_time > now()
  ORDER BY start_time DESC
  LIMIT 1;

  -- If no active cycle, create one
  IF active_cycle_id IS NULL THEN
    INSERT INTO home_feature_cycles (start_time, end_time)
    VALUES (now(), now() + INTERVAL '30 minutes')
    RETURNING id INTO active_cycle_id;
  END IF;

  RETURN active_cycle_id;
END;
$$ LANGUAGE plpgsql;

-- Function to record spend
CREATE OR REPLACE FUNCTION record_home_feature_spend(p_user_id UUID, p_coins_spent BIGINT)
RETURNS VOID AS $$
DECLARE
  cycle_id UUID;
BEGIN
  -- Get active cycle
  cycle_id := get_or_create_active_cycle();

  -- Insert spend record
  INSERT INTO home_feature_spend (cycle_id, user_id, coins_spent)
  VALUES (cycle_id, p_user_id, p_coins_spent);

  -- Increment total
  UPDATE home_feature_cycles
  SET total_spent_coins = total_spent_coins + p_coins_spent
  WHERE id = cycle_id;
END;
$$ LANGUAGE plpgsql;

-- Function to end cycle and determine winner
CREATE OR REPLACE FUNCTION end_home_feature_cycle(p_cycle_id UUID)
RETURNS VOID AS $$
DECLARE
  winner_id UUID;
  total_spent BIGINT;
BEGIN
  -- Get total spent
  SELECT total_spent_coins INTO total_spent
  FROM home_feature_cycles
  WHERE id = p_cycle_id;

  -- If total < 10,000, just mark winner without payout
  IF total_spent < 10000 THEN
    -- Find top spender
    SELECT user_id INTO winner_id
    FROM home_feature_spend
    WHERE cycle_id = p_cycle_id
    GROUP BY user_id
    ORDER BY SUM(coins_spent) DESC
    LIMIT 1;

    UPDATE home_feature_cycles
    SET winner_user_id = winner_id
    WHERE id = p_cycle_id;

    RETURN;
  END IF;

  -- Find top spender and payout
  SELECT user_id INTO winner_id
  FROM home_feature_spend
  WHERE cycle_id = p_cycle_id
  GROUP BY user_id
  ORDER BY SUM(coins_spent) DESC
  LIMIT 1;

  -- Credit 1,000 paid coins via existing logic (assuming deduct_coins can be negative for credit)
  -- Actually, use a separate function or direct insert
  -- For now, insert transaction
  INSERT INTO coin_transactions (user_id, coins, usd_amount, source, external_id, payer_email, payment_status, payment_method, metadata)
  VALUES (winner_id, 1000, 0, 'platform_bonus', 'home_feature_reward_' || p_cycle_id, NULL, 'completed', 'platform', json_build_object('cycle_id', p_cycle_id));

  -- Update user balance
  UPDATE user_profiles
  SET paid_coin_balance = paid_coin_balance + 1000
  WHERE id = winner_id;

  -- Mark cycle as paid
  UPDATE home_feature_cycles
  SET winner_user_id = winner_id, reward_paid = true
  WHERE id = p_cycle_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to end cycle when time expires (run periodically)
-- This would be called by a cron job or scheduled function