-- Migration: Create game_matches table for Troll Games
-- Date: 2027-05-01

-- Table to store game match records
CREATE TABLE IF NOT EXISTS game_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_type VARCHAR(50) NOT NULL,
  players UUID[] NOT NULL DEFAULT '{}',
  winner_id UUID REFERENCES auth.users(id),
  coins_awarded INTEGER NOT NULL DEFAULT 0,
  reward_claimed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Additional metadata
  match_data JSONB DEFAULT '{}'::jsonb,
  
  -- Constraints
  CONSTRAINT positive_coins CHECK (coins_awarded >= 0)
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_game_matches_game_type ON game_matches(game_type);
CREATE INDEX IF NOT EXISTS idx_game_matches_winner_id ON game_matches(winner_id);
CREATE INDEX IF NOT EXISTS idx_game_matches_created_at ON game_matches(created_at DESC);

-- Enable RLS
ALTER TABLE game_matches ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own matches
CREATE POLICY "Users can view own game matches" ON game_matches
  FOR SELECT
  USING (auth.uid() = ANY(players));

-- Policy: Service role can do everything
CREATE POLICY "Service role full access to game_matches" ON game_matches
  FOR ALL
  USING (auth.role() = 'service_role');

-- Function to securely award game coins
-- This is the main function called by the game logic to award coins
CREATE OR REPLACE FUNCTION award_game_coins(
  p_user_id UUID,
  p_game_type VARCHAR(50),
  p_match_id UUID,
  p_amount INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_wallet_id UUID;
  v_existing_match RECORD;
  v_current_balance INTEGER;
BEGIN
  -- Validate inputs
  IF p_user_id IS NULL OR p_game_type IS NULL OR p_match_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing required parameters');
  END IF;

  IF p_amount <= 0 OR p_amount > 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid coin amount');
  END IF;

  -- Verify match exists and is valid
  SELECT * INTO v_existing_match
  FROM game_matches
  WHERE id = p_match_id 
    AND game_type = p_game_type
    AND winner_id = p_user_id
    AND reward_claimed = FALSE;

  IF v_existing_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid match or reward already claimed');
  END IF;

  -- Get or create user wallet
  SELECT id INTO v_wallet_id
  FROM wallets
  WHERE user_id = p_user_id;

  IF v_wallet_id IS NULL THEN
    -- Create wallet if doesn't exist
    INSERT INTO wallets (user_id, balance)
    VALUES (p_user_id, 0)
    RETURNING id INTO v_wallet_id;
  END IF;

  -- Get current balance
  SELECT balance INTO v_current_balance
  FROM wallets
  WHERE id = v_wallet_id;

  -- Update wallet balance
  UPDATE wallets
  SET balance = balance + p_amount,
      updated_at = NOW()
  WHERE id = v_wallet_id;

  -- Record transaction
  INSERT INTO wallet_transactions (
    wallet_id,
    user_id,
    amount,
    transaction_type,
    description,
    metadata
  ) VALUES (
    v_wallet_id,
    p_user_id,
    p_amount,
    'game_reward',
    format('Won %s game', p_game_type),
    jsonb_build_object(
      'game_type', p_game_type,
      'match_id', p_match_id,
      'previous_balance', v_current_balance
    )
  );

  -- Mark reward as claimed in match record
  UPDATE game_matches
  SET reward_claimed = TRUE, coins_awarded = p_amount
  WHERE id = p_match_id;

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'coins_awarded', p_amount,
    'new_balance', v_current_balance + p_amount,
    'match_id', p_match_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Function to create a new game match
CREATE OR REPLACE FUNCTION create_game_match(
  p_game_type VARCHAR(50),
  p_players UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match_id UUID;
BEGIN
  -- Validate minimum players for multiplayer games
  IF array_length(p_players, 1) < 2 THEN
    RAISE EXCEPTION 'At least 2 players required for multiplayer games';
  END IF;

  -- Create match record
  INSERT INTO game_matches (game_type, players)
  VALUES (p_game_type, p_players)
  RETURNING id INTO v_match_id;

  RETURN v_match_id;
END;
$$;

-- Function to set match winner
CREATE OR REPLACE FUNCTION set_match_winner(
  p_match_id UUID,
  p_winner_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only the winner or service role can set the winner
  IF auth.uid() != p_winner_id AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized to set winner';
  END IF;

  UPDATE game_matches
  SET winner_id = p_winner_id
  WHERE id = p_match_id
    AND winner_id IS NULL;

  RETURN FOUND;
END;
$$;

-- Function to check if user recently played (anti-cheat cooldown)
CREATE OR REPLACE FUNCTION check_game_cooldown(
  p_user_id UUID,
  p_game_type VARCHAR(50),
  p_seconds INTEGER DEFAULT 30
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recent_match BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM game_matches
    WHERE game_type = p_game_type
      AND p_user_id = ANY(players)
      AND created_at > NOW() - (p_seconds || ' seconds')::interval
  ) INTO v_recent_match;

  RETURN v_recent_match;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION award_game_coins TO service_role;
GRANT EXECUTE ON FUNCTION create_game_match TO service_role;
GRANT EXECUTE ON FUNCTION set_match_winner TO service_role;
GRANT EXECUTE ON FUNCTION check_game_cooldown TO service_role;
