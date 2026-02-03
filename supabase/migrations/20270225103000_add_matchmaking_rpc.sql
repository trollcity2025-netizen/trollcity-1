
-- Function to find a random opponent for a battle
-- Excludes:
-- 1. The requester themselves
-- 2. Offline streams (is_live = false)
-- 3. Streams already in battle (is_battle = true)
-- 4. Streams that are currently in a pending/active battle (check battles table)
-- 5. Recent opponents (last 5 battles or battles within last 1 hour)

CREATE OR REPLACE FUNCTION find_match_candidate(
    p_stream_id UUID
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    title TEXT,
    viewer_count INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_recent_opponent_ids UUID[];
    v_busy_stream_ids UUID[];
BEGIN
    -- 1. Get IDs of recent opponents (last 10 battles involving p_stream_id)
    SELECT ARRAY_AGG(
        CASE 
            WHEN challenger_stream_id = p_stream_id THEN opponent_stream_id
            ELSE challenger_stream_id
        END
    )
    INTO v_recent_opponent_ids
    FROM (
        SELECT challenger_stream_id, opponent_stream_id
        FROM battles
        WHERE (challenger_stream_id = p_stream_id OR opponent_stream_id = p_stream_id)
        AND status IN ('ended', 'active')
        ORDER BY created_at DESC
        LIMIT 10
    ) recent;

    -- 2. Get IDs of streams currently in a pending or active battle (busy)
    SELECT ARRAY_AGG(
        CASE 
            WHEN challenger_stream_id = p_stream_id THEN opponent_stream_id -- Should not happen if we filter p_stream_id
            WHEN opponent_stream_id = p_stream_id THEN challenger_stream_id -- Should not happen
            ELSE 
                CASE 
                    WHEN challenger_stream_id IS NOT NULL THEN challenger_stream_id
                    ELSE opponent_stream_id
                END
        END
    )
    INTO v_busy_stream_ids
    FROM battles
    WHERE status IN ('pending', 'active');

    -- 3. Return a random stream meeting criteria
    RETURN QUERY
    SELECT s.id, s.user_id, s.title, s.viewer_count
    FROM streams s
    WHERE s.is_live = TRUE
      AND s.is_battle = FALSE
      AND s.id != p_stream_id
      AND (v_recent_opponent_ids IS NULL OR NOT (s.id = ANY(v_recent_opponent_ids)))
      AND (v_busy_stream_ids IS NULL OR NOT (s.id = ANY(v_busy_stream_ids)))
    ORDER BY RANDOM()
    LIMIT 1;
END;
$$;
