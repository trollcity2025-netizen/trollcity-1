-- Advanced XP System: Streamer Rewards & Prestige

-- 1. Ensure streams has ended_at if not present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'streams' AND column_name = 'ended_at'
    ) THEN
        ALTER TABLE streams ADD COLUMN ended_at TIMESTAMPTZ;
    END IF;
END $$;

-- 2. Add Multipliers to User Profiles for Prestige
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'xp_multiplier'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN xp_multiplier DECIMAL(4,2) DEFAULT 1.0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'coin_multiplier'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN coin_multiplier DECIMAL(4,2) DEFAULT 1.0;
    END IF;
END $$;

-- 3. Streamer XP Trigger
CREATE OR REPLACE FUNCTION trigger_award_streamer_xp()
RETURNS TRIGGER AS $$
DECLARE
    v_duration_mins INTEGER;
    v_xp_amount INTEGER;
BEGIN
    -- Only run when stream ends (is_live changes to false, or ended_at is set)
    IF (OLD.is_live = true AND NEW.is_live = false) OR (OLD.ended_at IS NULL AND NEW.ended_at IS NOT NULL) THEN
        
        -- Calculate duration in minutes
        -- If ended_at is null (just flipped is_live), use NOW()
        -- If start_time is null, skip
        IF NEW.start_time IS NOT NULL THEN
            v_duration_mins := EXTRACT(EPOCH FROM (COALESCE(NEW.ended_at, NOW()) - NEW.start_time)) / 60;
            
            -- Ensure positive duration
            IF v_duration_mins > 0 THEN
                -- Award 10 XP per minute
                v_xp_amount := v_duration_mins * 10;
                
                -- Cap per stream? Maybe 3000 XP (5 hours)
                v_xp_amount := LEAST(v_xp_amount, 3000);
                
                -- Award XP
                PERFORM add_xp(NEW.broadcaster_id, v_xp_amount, 'stream');
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_streamer_xp ON streams;
CREATE TRIGGER trg_streamer_xp
AFTER UPDATE ON streams
FOR EACH ROW
EXECUTE FUNCTION trigger_award_streamer_xp();


-- 4. Prestige Function
CREATE OR REPLACE FUNCTION prestige_user(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_user_profile user_profiles%ROWTYPE;
    v_new_prestige INTEGER;
BEGIN
    -- Get user profile
    SELECT * INTO v_user_profile FROM user_profiles WHERE id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'User not found');
    END IF;

    -- Check requirements (Level 50)
    IF v_user_profile.level < 50 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Must be level 50 to prestige');
    END IF;

    v_new_prestige := v_user_profile.prestige_level + 1;

    -- Update User: Reset Level, XP, Increment Prestige, Boost Multipliers
    UPDATE user_profiles SET
        level = 1,
        current_xp = 0,
        prestige_level = v_new_prestige,
        xp_multiplier = xp_multiplier + 0.10, -- +10% XP per prestige
        coin_multiplier = coin_multiplier + 0.05 -- +5% Coins per prestige
    WHERE id = p_user_id;

    -- Award Prestige Badge (via Perks system if possible, or just JSON rewards)
    -- We'll assume the frontend checks prestige_level for the badge, 
    -- but we can also add a specific perk if we want.
    
    -- Log it
    INSERT INTO xp_logs (user_id, source, amount) 
    VALUES (p_user_id, 'prestige_reset', 0);

    RETURN jsonb_build_object(
        'success', true, 
        'new_prestige', v_new_prestige,
        'message', 'Prestige successful! Level reset to 1. Multipliers increased.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
