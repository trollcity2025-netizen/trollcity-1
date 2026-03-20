-- ============================================================================
-- QUERY TO VIEW EARNED CROWNS FROM BATTLES
-- ============================================================================

-- View all users with their battle crowns and streaks
SELECT 
  id,
  username,
  battle_crowns as crowns_earned,
  battle_crown_streak as current_streak,
  created_at as account_created
FROM user_profiles
WHERE battle_crowns > 0
ORDER BY battle_crowns DESC
LIMIT 50;

-- View battle history with crown awards
SELECT 
  b.id as battle_id,
  b.status,
  b.started_at,
  b.ended_at,
  b.winner_stream_id,
  b.winner_id,
  ch.title as challenger_title,
  ch.user_id as challenger_user_id,
  op.title as opponent_title,
  op.user_id as opponent_user_id,
  b.score_challenger,
  b.score_opponent,
  CASE 
    WHEN b.winner_id = ch.user_id THEN 'Challenger'
    WHEN b.winner_id = op.user_id THEN 'Opponent'
    ELSE 'Draw/Unknown'
  END as winner_side,
  -- Calculate duration
  EXTRACT(EPOCH FROM (b.ended_at - b.started_at))/60 as duration_minutes
FROM battles b
LEFT JOIN streams ch ON b.challenger_stream_id = ch.id
LEFT JOIN streams op ON b.opponent_stream_id = op.id
WHERE b.status = 'ended'
ORDER BY b.ended_at DESC
LIMIT 100;

-- View crown earning history (if there's a transaction table)
-- First check if there's a battle_crown_transactions or similar table
SELECT 
  table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%crown%';

-- View users with most battle wins (crowns)
SELECT 
  up.id,
  up.username,
  up.battle_crowns as total_crowns,
  up.battle_crown_streak as current_streak,
  -- Estimate wins (each crown = 1 win typically)
  up.battle_crowns as estimated_wins
FROM user_profiles up
WHERE up.battle_crowns IS NOT NULL AND up.battle_crowns > 0
ORDER BY up.battle_crowns DESC
LIMIT 20;

-- ============================================================================
-- CHECK IF CROWNS WERE ACTUALLY AWARDED IN RECENT BATTLES
-- ============================================================================

-- Check recent ended battles to see if they have winners
SELECT 
  b.id,
  b.status,
  b.winner_id,
  b.winner_stream_id,
  CASE 
    WHEN b.winner_stream_id IS NOT NULL THEN 'Yes'
    ELSE 'No'
  END as has_winner,
  b.created_at,
  b.started_at,
  b.ended_at
FROM battles b
WHERE b.status = 'ended'
ORDER BY b.ended_at DESC
LIMIT 20;

-- Check if user_profiles were updated with crowns after battle end
-- This compares battle end times with profile update times
SELECT 
  up.id as user_id,
  up.username,
  up.battle_crowns,
  up.battle_crown_streak,
  up.updated_at as last_profile_update
FROM user_profiles up
WHERE up.battle_crowns > 0
ORDER BY up.updated_at DESC
LIMIT 20;
