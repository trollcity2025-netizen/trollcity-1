-- Add user like tracking table for stream likes with coin rewards
-- This tracks cumulative likes per user per stream

CREATE TABLE IF NOT EXISTS user_stream_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
    like_count INTEGER NOT NULL DEFAULT 0,
    coins_earned INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, stream_id)
);

-- Add index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_stream_likes_user_stream ON user_stream_likes(user_id, stream_id);
CREATE INDEX IF NOT EXISTS idx_user_stream_likes_stream ON user_stream_likes(stream_id);

-- Enable RLS
ALTER TABLE user_stream_likes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own like counts"
    ON user_stream_likes FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own like counts"
    ON user_stream_likes FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own like counts"
    ON user_stream_likes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Function to add a like and potentially award coins
CREATE OR REPLACE FUNCTION add_stream_like(
    p_stream_id UUID,
    p_user_id UUID
)
RETURNS TABLE (
    new_total_likes INTEGER,
    user_like_count INTEGER,
    coins_awarded INTEGER,
    total_coins_earned INTEGER
) AS $$
DECLARE
    v_user_likes INTEGER;
    v_coins_earned INTEGER;
    v_new_coins INTEGER := 0;
    v_total_stream_likes INTEGER;
    v_previous_coins INTEGER;
BEGIN
    -- Insert or update user like count
    INSERT INTO user_stream_likes (user_id, stream_id, like_count)
    VALUES (p_user_id, p_stream_id, 1)
    ON CONFLICT (user_id, stream_id)
    DO UPDATE SET 
        like_count = user_stream_likes.like_count + 1,
        updated_at = NOW()
    RETURNING user_stream_likes.like_count, user_stream_likes.coins_earned
    INTO v_user_likes, v_previous_coins;
    
    -- Check if user hit a 10k milestone and award coins
    -- Award 1 coin for every 10k likes (10000, 20000, 30000, etc.)
    v_coins_earned := v_user_likes / 10000;
    
    IF v_coins_earned > v_previous_coins THEN
        v_new_coins := v_coins_earned - v_previous_coins;
        
        -- Update coins earned in the tracking table
        UPDATE user_stream_likes
        SET coins_earned = v_coins_earned
        WHERE user_id = p_user_id AND stream_id = p_stream_id;
        
        -- Award troll_coins to user
        UPDATE user_profiles
        SET troll_coins = COALESCE(troll_coins, 0) + v_new_coins
        WHERE id = p_user_id;
    END IF;
    
    -- Update total stream likes
    UPDATE streams
    SET total_likes = COALESCE(total_likes, 0) + 1
    WHERE id = p_stream_id
    RETURNING total_likes INTO v_total_stream_likes;
    
    RETURN QUERY SELECT 
        v_total_stream_likes,
        v_user_likes,
        v_new_coins,
        v_coins_earned;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
