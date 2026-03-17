-- ============================================================
-- BATTLE STREAM RELATIONSHIP FIX
-- Fixes invalid challenger_stream_id and opponent_stream_id values
-- that don't reference valid streams.id rows
-- ============================================================

-- 1. FIRST: Identify ALL invalid battles (rows with non-existent stream IDs)
-- This helps understand the scope of the problem

SELECT 
    b.id as battle_id,
    b.challenger_stream_id,
    b.opponent_stream_id,
    b.status,
    b.created_at,
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM streams s WHERE s.id = b.challenger_stream_id) THEN 'INVALID_CHALLENGER'
        ELSE 'VALID'
    END as challenger_status,
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM streams s WHERE s.id = b.opponent_stream_id) THEN 'INVALID_OPPONENT'
        ELSE 'VALID'
    END as opponent_status
FROM battles b
WHERE 
    NOT EXISTS (SELECT 1 FROM streams s WHERE s.id = b.challenger_stream_id)
    OR NOT EXISTS (SELECT 1 FROM streams s WHERE s.id = b.opponent_stream_id)
ORDER BY b.created_at DESC;

-- 2. Count of invalid battles
SELECT 
    COUNT(*) as total_invalid,
    SUM(CASE WHEN NOT EXISTS (SELECT 1 FROM streams s WHERE s.id = b.challenger_stream_id) THEN 1 ELSE 0 END) as invalid_challenger,
    SUM(CASE WHEN NOT EXISTS (SELECT 1 FROM streams s WHERE s.id = b.opponent_stream_id) THEN 1 ELSE 0 END) as invalid_opponent
FROM battles b
WHERE 
    NOT EXISTS (SELECT 1 FROM streams s WHERE s.id = b.challenger_stream_id)
    OR NOT EXISTS (SELECT 1 FROM streams s WHERE s.id = b.opponent_stream_id);

-- 3. Check if foreign keys exist (if not, they'll fail on insert with bad data)
-- The table should have these FK constraints:
-- battles_challenger_stream_id_fkey -> streams(id)
-- battles_opponent_stream_id_fkey -> streams(id)

-- Check current foreign keys
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
    AND tc.table_name = 'battles';

-- 4. If FK is missing, add it (but first we need to clean invalid data)
-- This will fail if there are invalid rows, which is why we clean first

-- 5. CLEANUP: Delete battles with invalid stream IDs
-- NOTE: This deletes broken data. If you want to preserve, you need to repair instead.

-- Delete battles where challenger_stream_id doesn't exist
DELETE FROM battles 
WHERE id IN (
    SELECT b.id FROM battles b
    WHERE NOT EXISTS (SELECT 1 FROM streams s WHERE s.id = b.challenger_stream_id)
);

-- Delete battles where opponent_stream_id doesn't exist  
DELETE FROM battles 
WHERE id IN (
    SELECT b.id FROM battles b
    WHERE NOT EXISTS (SELECT 1 FROM streams s WHERE s.id = b.opponent_stream_id)
);

-- 6. Verify cleanup - should return 0 rows
SELECT COUNT(*) as invalid_remaining FROM battles b
WHERE 
    NOT EXISTS (SELECT 1 FROM streams s WHERE s.id = b.challenger_stream_id)
    OR NOT EXISTS (SELECT 1 FROM streams s WHERE s.id = b.opponent_stream_id);

-- 7. Now add foreign keys if they don't exist
-- Add challenger_stream_id FK
ALTER TABLE battles 
ADD CONSTRAINT IF NOT EXISTS battles_challenger_stream_id_fkey 
FOREIGN KEY (challenger_stream_id) REFERENCES streams(id) ON DELETE CASCADE;

-- Add opponent_stream_id FK
ALTER TABLE battles 
ADD CONSTRAINT IF NOT EXISTS battles_opponent_stream_id_fkey 
FOREIGN KEY (opponent_stream_id) REFERENCES streams(id) ON DELETE CASCADE;

-- ============================================================
-- END OF CLEANUP
-- ============================================================
