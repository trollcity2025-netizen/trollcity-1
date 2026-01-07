-- Followers System (matching frontend 'user_follows')
CREATE TABLE IF NOT EXISTS user_follows (
    follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id)
);

-- RLS
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access" ON user_follows;
CREATE POLICY "Public read access" ON user_follows
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can follow others" ON user_follows;
CREATE POLICY "Users can follow others" ON user_follows
    FOR INSERT WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Users can unfollow" ON user_follows;
CREATE POLICY "Users can unfollow" ON user_follows
    FOR DELETE USING (auth.uid() = follower_id);

-- Toggle Follow Function
CREATE OR REPLACE FUNCTION toggle_follow(target_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    is_following BOOLEAN;
BEGIN
    IF auth.uid() = target_user_id THEN
        RAISE EXCEPTION 'Cannot follow yourself';
    END IF;

    SELECT EXISTS(
        SELECT 1 FROM user_follows 
        WHERE follower_id = auth.uid() AND following_id = target_user_id
    ) INTO is_following;

    IF is_following THEN
        DELETE FROM user_follows 
        WHERE follower_id = auth.uid() AND following_id = target_user_id;
        RETURN false; -- No longer following
    ELSE
        INSERT INTO user_follows (follower_id, following_id)
        VALUES (auth.uid(), target_user_id);
        RETURN true; -- Now following
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Entrance Effects Logic
-- Ensure only one active effect per user
CREATE OR REPLACE FUNCTION set_active_entrance_effect(p_effect_id TEXT)
RETURNS VOID AS $$
BEGIN
    -- Deactivate all effects for the user in user_entrance_effects
    -- Assuming user_entrance_effects has an is_active column
    -- If it doesn't, we need to add it or rely on a different mechanism.
    -- Based on previous context, it likely has it. If not, I'll add it.
    
    -- First, check if column exists, if not add it (safe to do in migration)
    -- But in function I can't do DDL easily. I'll assume it exists or add it in a separate block below.
    
    UPDATE user_entrance_effects
    SET is_active = false
    WHERE user_id = auth.uid();

    -- Activate the selected effect (if p_effect_id is provided)
    IF p_effect_id IS NOT NULL THEN
        UPDATE user_entrance_effects
        SET is_active = true
        WHERE user_id = auth.uid() AND effect_id = p_effect_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add is_active column if it doesn't exist (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_entrance_effects' AND column_name = 'is_active') THEN
        ALTER TABLE user_entrance_effects ADD COLUMN is_active BOOLEAN DEFAULT false;
    END IF;
END $$;
