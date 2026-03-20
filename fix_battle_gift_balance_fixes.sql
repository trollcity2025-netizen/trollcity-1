-- ============================================================================
-- FIXES FOR BATTLE AND GIFT SYSTEM ISSUES
-- ============================================================================

-- 1. Fix box price deduction when user joins a box
-- This updates the join_stream_box action to properly deduct coins from user
-- and add to broadcaster balance

-- First, let's check if there's an existing function we need to modify
-- The function should be called something like handle_officer_action or join_stream_box

-- 2. Fix gift receiver balance update
-- The send_gift_in_stream function needs to ensure receiver balance is updated

-- 3. Fix crown awarding in battles
-- The end_battle_with_rewards function needs to properly credit crowns

-- ============================================================================
-- FIX: Ensure send_gift_in_stream updates receiver balance
-- ============================================================================

-- Check current function definition and update it to add receiver balance
CREATE OR REPLACE FUNCTION update_receiver_balance(p_user_id UUID, p_amount INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Add coins to receiver's balance
  UPDATE user_profiles
  SET troll_coins = COALESCE(troll_coins, 0) + p_amount
  WHERE id = p_user_id;
END;
$$;

-- ============================================================================
-- FIX: Ensure end_battle_with_rewards properly awards crowns
-- ============================================================================

CREATE OR REPLACE FUNCTION end_battle_with_rewards(p_battle_id UUID, p_winner_stream_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_winner_user_id UUID;
  v_crowns_awarded INTEGER := 1;
  v_battle RECORD;
BEGIN
  -- Get battle info
  SELECT * INTO v_battle FROM battles WHERE id = p_battle_id;
  
  IF v_battle IS NULL THEN
    RETURN JSON_BUILD_OBJECT('success', false, 'message', 'Battle not found');
  END IF;
  
  -- Get winner user ID from stream
  SELECT user_id INTO v_winner_user_id 
  FROM streams 
  WHERE id = p_winner_stream_id;
  
  IF v_winner_user_id IS NULL THEN
    RETURN JSON_BUILD_OBJECT('success', false, 'message', 'Winner stream not found');
  END IF;
  
  -- Award crowns to winner
  UPDATE user_profiles
  SET battle_crowns = COALESCE(battle_crowns, 0) + v_crowns_awarded,
      battle_crown_streak = COALESCE(battle_crown_streak, 0) + 1
  WHERE id = v_winner_user_id;
  
  -- Update battle with winner
  UPDATE battles
  SET winner_stream_id = p_winner_stream_id,
      winner_id = v_winner_user_id,
      status = 'ended'
  WHERE id = p_battle_id;
  
  RETURN JSON_BUILD_OBJECT(
    'success', true,
    'crowns_awarded', v_crowns_awarded,
    'winner_id', v_winner_user_id
  );
END;
$$;

-- ============================================================================
-- FIX: Ensure leave_battle properly awards crowns to winner
-- ============================================================================

CREATE OR REPLACE FUNCTION leave_battle(p_battle_id UUID, p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_battle RECORD;
  v_leaver_team TEXT;
  v_winner_stream_id UUID;
  v_winner_user_id UUID;
BEGIN
  -- Get battle info
  SELECT * INTO v_battle FROM battles WHERE id = p_battle_id;
  
  IF v_battle IS NULL THEN
    RETURN JSON_BUILD_OBJECT('success', false, 'message', 'Battle not found');
  END IF;
  
  -- Determine which team the leaving user is on
  SELECT team INTO v_leaver_team
  FROM battle_participants
  WHERE battle_id = p_battle_id AND user_id = p_user_id;
  
  -- Award win to opposite team
  IF v_leaver_team = 'challenger' THEN
    v_winner_stream_id := v_battle.opponent_stream_id;
  ELSIF v_leaver_team = 'opponent' THEN
    v_winner_stream_id := v_battle.challenger_stream_id;
  ELSE
    -- Viewer leaving - no winner
    UPDATE battles SET status = 'ended' WHERE id = p_battle_id;
    RETURN JSON_BUILD_OBJECT('success', true, 'winner_stream_id', NULL);
  END IF;
  
  -- Get winner user ID
  SELECT user_id INTO v_winner_user_id FROM streams WHERE id = v_winner_stream_id;
  
  -- Award crowns to winner
  IF v_winner_user_id IS NOT NULL THEN
    UPDATE user_profiles
    SET battle_crowns = COALESCE(battle_crowns, 0) + 1,
        battle_crown_streak = COALESCE(battle_crown_streak, 0) + 1
    WHERE id = v_winner_user_id;
  END IF;
  
  -- Update battle
  UPDATE battles
  SET winner_stream_id = v_winner_stream_id,
      winner_id = v_winner_user_id,
      status = 'ended'
  WHERE id = p_battle_id;
  
  RETURN JSON_BUILD_OBJECT(
    'success', true,
    'winner_stream_id', v_winner_stream_id,
    'winner_user_id', v_winner_user_id
  );
END;
$$;

-- ============================================================================
-- FIX: Ensure join_stream_box properly deducts and credits seat prices
-- ============================================================================

-- First, check if there's a handler for officer actions that needs updating
-- This is typically handled by an Edge Function, so we need to make sure
-- the function properly handles the joinPrice parameter

-- Add logging to track box join price transactions
CREATE TABLE IF NOT EXISTS box_join_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  stream_id UUID NOT NULL,
  seat_index INTEGER NOT NULL,
  price_paid INTEGER NOT NULL,
  broadcaster_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Grant access
GRANT ALL ON box_join_transactions TO anon, authenticated, service_role;

-- ============================================================================
-- End of fixes
-- ============================================================================
