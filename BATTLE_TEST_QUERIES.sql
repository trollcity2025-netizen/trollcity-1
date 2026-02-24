-- =============================================
-- BATTLE SYSTEM DIAGNOSTIC QUERIES
-- =============================================
-- This file contains SQL queries to test and verify
-- the battle system is working correctly
-- Run these in Supabase SQL Editor

-- =============================================
-- 1. CHECK BATTLE TABLE STRUCTURE
-- =============================================
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'battles'
ORDER BY ordinal_position;

-- =============================================
-- 2. CHECK BATTLE_PARTICIPANTS TABLE
-- =============================================
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'battle_participants'
ORDER BY ordinal_position;

-- =============================================
-- 3. CHECK STREAMS BATTLE FIELDS
-- =============================================
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'streams' 
AND column_name IN ('battle_id', 'is_battle')
ORDER BY column_name;

-- =============================================
-- 4. CHECK BATTLE RPC FUNCTIONS
-- =============================================
SELECT routine_name, routine_type, data_type AS return_type
FROM information_schema.routines 
WHERE routine_name IN (
  'create_battle_challenge',
  'accept_battle', 
  'end_battle',
  'end_battle_guarded',
  'leave_battle',
  'record_battle_skip',
  'register_battle_score',
  'distribute_battle_winnings'
)
AND routine_schema = 'public';

-- =============================================
-- 5. CHECK FOR EXISTING BATTLES
-- =============================================
SELECT 
  b.id,
  b.status,
  b.score_challenger,
  b.score_opponent,
  b.started_at,
  b.ended_at,
  b.created_at,
  s1.title AS challenger_stream,
  s2.title AS opponent_stream
FROM battles b
LEFT JOIN streams s1 ON b.challenger_stream_id = s1.id
LEFT JOIN streams s2 ON b.opponent_stream_id = s2.id
ORDER BY b.created_at DESC
LIMIT 20;

-- =============================================
-- 6. CHECK BATTLE PARTICIPANTS
-- =============================================
SELECT 
  bp.battle_id,
  bp.user_id,
  bp.role,
  bp.team,
  bp.username,
  up.username AS profile_username
FROM battle_participants bp
LEFT JOIN user_profiles up ON bp.user_id = up.id
WHERE bp.battle_id = (SELECT id FROM battles ORDER BY created_at DESC LIMIT 1)
ORDER BY bp.team, bp.role;

-- =============================================
-- 7. CHECK ACTIVE BATTLES
-- =============================================
SELECT 
  b.id,
  b.status,
  EXTRACT(EPOCH FROM (NOW() - b.started_at))::integer AS seconds_active,
  s1.title AS challenger_stream,
  s2.title AS opponent_stream,
  b.score_challenger,
  b.score_opponent,
  (b.score_challenger + b.score_opponent) AS total_score
FROM battles b
LEFT JOIN streams s1 ON b.challenger_stream_id = s1.id
LEFT JOIN streams s2 ON b.opponent_stream_id = s2.id
WHERE b.status = 'active'
ORDER BY b.started_at;

-- =============================================
-- 8. CHECK BATTLE GIFTS
-- =============================================
SELECT 
  sg.id,
  sg.sender_id,
  sg.receiver_id,
  sg.stream_id,
  sg.gift_id,
  sg.amount,
  sg.created_at,
  b.id AS battle_id,
  b.status AS battle_status
FROM stream_gifts sg
JOIN streams s ON sg.stream_id = s.id
LEFT JOIN battles b ON s.battle_id = b.id
WHERE b.id IS NOT NULL
ORDER BY sg.created_at DESC
LIMIT 50;

-- =============================================
-- 9. CHECK BATTLE MESSAGES
-- =============================================
SELECT 
  m.id,
  m.stream_id,
  m.user_id,
  m.content,
  m.message_type,
  m.created_at,
  s.title AS stream_title,
  b.id AS battle_id,
  b.status AS battle_status
FROM messages m
JOIN streams s ON m.stream_id = s.id
LEFT JOIN battles b ON s.battle_id = b.id
WHERE b.id IS NOT NULL
ORDER BY m.created_at DESC
LIMIT 50;

-- =============================================
-- 10. TEST BATTLE CHALLENGE CREATION
-- =============================================
-- This will create a test battle between two existing streams
-- Replace stream IDs with actual stream IDs from your database

-- First, get two active streams
SELECT id, title, user_id, status 
FROM streams 
WHERE status = 'live' 
AND is_live = true
LIMIT 2;

-- Then create a battle (replace with actual stream IDs)
-- SELECT create_battle_challenge('stream-uuid-1', 'stream-uuid-2');

-- =============================================
-- 11. TEST BATTLE ACCEPTANCE
-- =============================================
-- Replace with actual battle ID
-- SELECT accept_battle('battle-uuid');

-- =============================================
-- 12. TEST SCORE REGISTRATION
-- =============================================
-- Replace with actual battle ID
-- SELECT register_battle_score('battle-uuid', 'challenger', 100);
-- SELECT register_battle_score('battle-uuid', 'opponent', 150);

-- =============================================
-- 13. TEST BATTLE ENDING
-- =============================================
-- Replace with actual battle ID and winner stream ID
-- SELECT end_battle_guarded('battle-uuid', 'winner-stream-uuid');

-- =============================================
-- 14. TEST WINNINGS DISTRIBUTION
-- =============================================
-- Replace with actual battle ID
-- SELECT distribute_battle_winnings('battle-uuid');

-- =============================================
-- 15. CHECK BATTLE LEADERBOARD
-- =============================================
SELECT 
  u.id,
  up.username,
  COUNT(b.id) AS total_battles,
  SUM(CASE WHEN b.winner_stream_id IN (
    SELECT id FROM streams WHERE broadcaster_id = u.id
  ) THEN 1 ELSE 0 END) AS wins,
  SUM(b.score_challenger + b.score_opponent) AS total_coins
FROM users u
JOIN user_profiles up ON u.id = up.id
JOIN battles b ON b.challenger_stream_id IN (
  SELECT id FROM streams WHERE broadcaster_id = u.id
) OR b.opponent_stream_id IN (
  SELECT id FROM streams WHERE broadcaster_id = u.id
)
WHERE b.status = 'ended'
GROUP BY u.id, up.username
ORDER BY wins DESC
LIMIT 20;

-- =============================================
-- 16. CHECK FOR BATTLE-RELATED ERRORS
-- =============================================
SELECT 
  se.message,
  se.stack,
  se.created_at,
  se.status
FROM system_errors se
WHERE se.message LIKE '%battle%'
OR se.message LIKE '%Battle%'
ORDER BY se.created_at DESC
LIMIT 20;

-- =============================================
-- 17. CHECK RLS POLICIES FOR BATTLES
-- =============================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename IN ('battles', 'battle_participants');

-- =============================================
-- 18. CHECK FOREIGN KEY CONSTRAINTS
-- =============================================
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name IN ('battles', 'battle_participants');

-- =============================================
-- 19. BATTLE STATISTICS
-- =============================================
SELECT 
  COUNT(*) AS total_battles,
  COUNT(CASE WHEN status = 'active' THEN 1 END) AS active_battles,
  COUNT(CASE WHEN status = 'ended' THEN 1 END) AS ended_battles,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending_battles,
  AVG(score_challenger + score_opponent) AS avg_total_score,
  MAX(score_challenger + score_opponent) AS max_total_score,
  MIN(EXTRACT(EPOCH FROM (ended_at - started_at))) AS min_duration_seconds,
  MAX(EXTRACT(EPOCH FROM (ended_at - started_at))) AS max_duration_seconds
FROM battles
WHERE started_at IS NOT NULL AND ended_at IS NOT NULL;

-- =============================================
-- 20. BATTLE TIMELINE CHECK
-- =============================================
SELECT 
  b.id,
  b.status,
  b.created_at AS challenge_created,
  b.started_at AS battle_started,
  b.ended_at AS battle_ended,
  CASE 
    WHEN b.ended_at IS NOT NULL AND b.started_at IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (b.ended_at - b.started_at))::integer 
    ELSE NULL 
  END AS duration_seconds,
  CASE
    WHEN b.ended_at IS NOT NULL AND b.started_at IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (b.ended_at - b.started_at))::integer / 60
    ELSE NULL
  END AS duration_minutes
FROM battles b
ORDER BY b.created_at DESC
LIMIT 20;
