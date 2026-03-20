-- ============================================================================
-- BACKFILL CROWNS FOR PAST BATTLES (INCLUDING FORFEITS)
-- ============================================================================
-- This script backfills battle crowns for all ended battles that have winners
-- Including battles that ended via forfeit
-- Run this to credit crowns to broadcasters who won battles but didn't receive them

-- First, let's see what battles need crowns backfilled (preview)
SELECT 
  b.id as battle_id,
  b.status,
  b.winner_stream_id,
  b.winner_id,
  ch.title as challenger_title,
  ch.user_id as challenger_user_id,
  op.title as opponent_title,
  op.user_id as opponent_user_id,
  b.score_challenger,
  b.score_opponent,
  CASE 
    WHEN b.score_challenger > b.score_opponent THEN 'Challenger Wins'
    WHEN b.score_opponent > b.score_challenger THEN 'Opponent Wins'
    WHEN b.winner_stream_id = b.challenger_stream_id THEN 'Challenger Wins (Forfeit)'
    WHEN b.winner_stream_id = b.opponent_stream_id THEN 'Opponent Wins (Forfeit)'
    ELSE 'Draw/Unknown'
  END as winner_type,
  b.created_at,
  b.started_at,
  b.ended_at
FROM battles b
LEFT JOIN streams ch ON b.challenger_stream_id = ch.id
LEFT JOIN streams op ON b.opponent_stream_id = op.id
WHERE b.status = 'ended'
AND b.winner_id IS NULL
AND (
  b.score_challenger IS NOT NULL 
  AND b.score_opponent IS NOT NULL 
  AND b.score_challenger != b.score_opponent
  OR b.winner_stream_id IS NOT NULL
)
ORDER BY b.ended_at DESC;

-- ============================================================================
-- BACKFILL: Award crowns to battle winners (including forfeits)
-- ============================================================================

-- 1. Update battles that have a clear winner by score but no winner_id set
-- For challenger wins by score
UPDATE battles b
SET winner_id = ch.user_id, winner_stream_id = b.challenger_stream_id
FROM streams ch
WHERE b.challenger_stream_id = ch.id
AND b.status = 'ended'
AND b.winner_id IS NULL
AND b.score_challenger > b.score_opponent;

-- For opponent wins by score
UPDATE battles b
SET winner_id = op.user_id, winner_stream_id = b.opponent_stream_id
FROM streams op
WHERE b.opponent_stream_id = op.id
AND b.status = 'ended'
AND b.winner_id IS NULL
AND b.score_opponent > b.score_challenger;

-- 2. Update battles that ended via FORFEIT (winner_stream_id set but winner_id not)
-- If challenger forfeited (winner is opponent)
UPDATE battles b
SET winner_id = op.user_id
FROM streams op
WHERE b.opponent_stream_id = op.id
AND b.status = 'ended'
AND b.winner_stream_id = b.opponent_stream_id
AND b.winner_id IS NULL;

-- If opponent forfeited (winner is challenger)
UPDATE battles b
SET winner_id = ch.user_id
FROM streams ch
WHERE b.challenger_stream_id = ch.id
AND b.status = 'ended'
AND b.winner_stream_id = b.challenger_stream_id
AND b.winner_id IS NULL;

-- ============================================================================
-- NOW CREDIT CROWNS TO USER PROFILES (including forfeits)
-- ============================================================================

-- Credit crowns to challengers who won by score
UPDATE user_profiles up
SET battle_crowns = COALESCE(battle_crowns, 0) + 1,
    battle_crown_streak = COALESCE(battle_crown_streak, 0) + 1
FROM battles b
JOIN streams ch ON b.challenger_stream_id = ch.id
WHERE up.id = ch.user_id
AND b.status = 'ended'
AND b.score_challenger > b.score_opponent
AND b.winner_id IS NULL;

-- Credit crowns to opponents who won by score
UPDATE user_profiles up
SET battle_crowns = COALESCE(battle_crowns, 0) + 1,
    battle_crown_streak = COALESCE(battle_crown_streak, 0) + 1
FROM battles b
JOIN streams op ON b.opponent_stream_id = op.id
WHERE up.id = op.user_id
AND b.status = 'ended'
AND b.score_opponent > b.score_challenger
AND b.winner_id IS NULL;

-- Credit crowns to opponents when challengers FORFEITED
UPDATE user_profiles up
SET battle_crowns = COALESCE(battle_crowns, 0) + 1,
    battle_crown_streak = COALESCE(battle_crown_streak, 0) + 1
FROM battles b
JOIN streams op ON b.opponent_stream_id = op.id
WHERE up.id = op.user_id
AND b.status = 'ended'
AND b.winner_stream_id = b.opponent_stream_id
AND b.winner_id IS NULL;

-- Credit crowns to challengers when opponents FORFEITED
UPDATE user_profiles up
SET battle_crowns = COALESCE(battle_crowns, 0) + 1,
    battle_crown_streak = COALESCE(battle_crown_streak, 0) + 1
FROM battles b
JOIN streams ch ON b.challenger_stream_id = ch.id
WHERE up.id = ch.user_id
AND b.status = 'ended'
AND b.winner_stream_id = b.challenger_stream_id
AND b.winner_id IS NULL;

-- ============================================================================
-- VERIFY THE BACKFILL
-- ============================================================================

-- Check how many crowns were awarded
SELECT 
  COUNT(*) as total_crowns_awarded,
  SUM(CASE WHEN battle_crowns > 0 THEN 1 ELSE 0 END) as users_with_crowns
FROM user_profiles
WHERE battle_crowns IS NOT NULL AND battle_crowns > 0;

-- View top crown earners
SELECT 
  id,
  username,
  battle_crowns as crowns,
  battle_crown_streak as streak
FROM user_profiles
WHERE battle_crowns > 0
ORDER BY battle_crowns DESC
LIMIT 20;

-- ============================================================================
-- Summary of what was backfilled
-- ============================================================================

SELECT 
  'Score-based wins (Challenger)' as type, COUNT(*) as count
FROM battles b WHERE b.status = 'ended' AND b.score_challenger > b.score_opponent AND b.winner_id IS NOT NULL
UNION ALL
SELECT 
  'Score-based wins (Opponent)' as type, COUNT(*) as count
FROM battles b WHERE b.status = 'ended' AND b.score_opponent > b.score_challenger AND b.winner_id IS NOT NULL
UNION ALL
SELECT 
  'Forfeits (Challenger won)' as type, COUNT(*) as count
FROM battles b WHERE b.status = 'ended' AND b.winner_stream_id = b.challenger_stream_id
UNION ALL
SELECT 
  'Forfeits (Opponent won)' as type, COUNT(*) as count
FROM battles b WHERE b.status = 'ended' AND b.winner_stream_id = b.opponent_stream_id;
