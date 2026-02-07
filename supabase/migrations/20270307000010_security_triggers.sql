-- Secure sensitive columns from direct modification by authenticated users
-- Prevents users from giving themselves coins, admin roles, or faking stream stats.

-- 1. Generic function to protect columns
CREATE OR REPLACE FUNCTION public.protect_sensitive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Allow service_role or superusers to bypass
    IF auth.role() = 'service_role' OR auth.role() = 'supabase_admin' THEN
        RETURN NEW;
    END IF;

    -- Check for sensitive column changes in user_profiles
    IF TG_TABLE_NAME = 'user_profiles' THEN
        -- Prevent role escalation
        IF NEW.role IS DISTINCT FROM OLD.role THEN
            RAISE EXCEPTION 'Cannot update restricted column: role';
        END IF;
        IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
            RAISE EXCEPTION 'Cannot update restricted column: is_admin';
        END IF;
        IF NEW.is_lead_officer IS DISTINCT FROM OLD.is_lead_officer THEN
            RAISE EXCEPTION 'Cannot update restricted column: is_lead_officer';
        END IF;
        
        -- Prevent currency manipulation
        IF NEW.troll_coins IS DISTINCT FROM OLD.troll_coins THEN
            RAISE EXCEPTION 'Cannot update restricted column: troll_coins';
        END IF;
        IF NEW.total_earned_coins IS DISTINCT FROM OLD.total_earned_coins THEN
            RAISE EXCEPTION 'Cannot update restricted column: total_earned_coins';
        END IF;
        
        -- Prevent leveling cheating
        IF NEW.level IS DISTINCT FROM OLD.level THEN
            RAISE EXCEPTION 'Cannot update restricted column: level';
        END IF;
        IF NEW.xp IS DISTINCT FROM OLD.xp THEN
            RAISE EXCEPTION 'Cannot update restricted column: xp';
        END IF;
    END IF;

    -- Check for sensitive column changes in streams
    IF TG_TABLE_NAME = 'streams' THEN
        -- Prevent faking live status
        IF NEW.is_live IS DISTINCT FROM OLD.is_live THEN
            RAISE EXCEPTION 'Cannot update restricted column: is_live';
        END IF;
        IF NEW.status IS DISTINCT FROM OLD.status THEN
             -- Allow 'ended' if user wants to stop stream? 
             -- Usually 'status' goes with 'is_live'. 
             -- Let's be strict: status changes should go via API/Webhook.
             -- But maybe the user clicks "Stop Stream" and it updates DB directly?
             -- If so, this breaks it.
             -- Let's check if the new status is 'ended' and old was 'live', maybe allow that?
             -- Safer to block and force use of RPC 'end_stream' if it exists, or just allow 'ended'.
             IF NEW.status = 'live' AND OLD.status != 'live' THEN
                 RAISE EXCEPTION 'Cannot manually set status to live';
             END IF;
        END IF;
        
        -- Prevent faking viewers
        IF NEW.current_viewers IS DISTINCT FROM OLD.current_viewers THEN
             -- Only allow if it's not increasing? No, block all.
             RAISE EXCEPTION 'Cannot update restricted column: current_viewers';
        END IF;

        -- Prevent HLS injection
        IF NEW.hls_url IS DISTINCT FROM OLD.hls_url THEN
            RAISE EXCEPTION 'Cannot update restricted column: hls_url';
        END IF;
        IF NEW.hls_path IS DISTINCT FROM OLD.hls_path THEN
            RAISE EXCEPTION 'Cannot update restricted column: hls_path';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- 2. Apply Triggers

DROP TRIGGER IF EXISTS trg_protect_user_profiles ON public.user_profiles;
CREATE TRIGGER trg_protect_user_profiles
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_sensitive_columns();

DROP TRIGGER IF EXISTS trg_protect_streams ON public.streams;
CREATE TRIGGER trg_protect_streams
BEFORE UPDATE ON public.streams
FOR EACH ROW
EXECUTE FUNCTION public.protect_sensitive_columns();
