
-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    action text NOT NULL,
    user_id uuid REFERENCES auth.users(id),
    target_id uuid,
    details jsonb,
    created_at timestamptz DEFAULT now(),
    ip_address text
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit_logs"
    ON audit_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND (is_admin = true)
        )
    );

CREATE POLICY "System can insert audit_logs"
    ON audit_logs FOR INSERT
    WITH CHECK (true); -- Ideally restrict to service role or specific functions

-- Create ip_bans table
CREATE TABLE IF NOT EXISTS ip_bans (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ip_address text NOT NULL,
    reason text,
    banned_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    banned_until timestamptz,
    is_active boolean DEFAULT true
);

ALTER TABLE ip_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and Officers can view ip_bans"
    ON ip_bans FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND (is_admin = true OR is_troll_officer = true)
        )
    );

CREATE POLICY "Admins and Officers can insert ip_bans"
    ON ip_bans FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND (is_admin = true OR is_troll_officer = true)
        )
    );

-- Function to ban IP
CREATE OR REPLACE FUNCTION ban_ip_address(
    p_ip_address text,
    p_ban_reason text,
    p_banned_until timestamptz DEFAULT null
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check permissions
    IF NOT EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid() AND (is_admin = true OR is_troll_officer = true)
    ) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    INSERT INTO ip_bans (ip_address, reason, banned_until, banned_by)
    VALUES (p_ip_address, p_ban_reason, p_banned_until, auth.uid());
    
    -- Log to audit_logs
    INSERT INTO audit_logs (action, user_id, details)
    VALUES ('ban_ip', auth.uid(), jsonb_build_object('ip', p_ip_address, 'reason', p_ban_reason));
END;
$$;

-- Function to restore banned account
CREATE OR REPLACE FUNCTION restore_banned_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_coins bigint;
    v_cost bigint := 2000;
BEGIN
    -- Get current coins
    SELECT coins INTO v_coins
    FROM user_profiles
    WHERE id = v_user_id;

    IF v_coins IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'User profile not found');
    END IF;

    IF v_coins < v_cost THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient coins');
    END IF;

    -- Deduct coins and unban
    -- Reset logic: User pays 2000 to unban, but loses everything (UI requirement)
    UPDATE user_profiles
    SET 
        coins = 0,
        xp = 0,
        level = 0, -- Assuming level column exists, otherwise ignore
        is_banned = false,
        ban_expires_at = null
    WHERE id = v_user_id;

    -- Log event
    INSERT INTO audit_logs (action, user_id, details)
    VALUES ('account_restored', v_user_id, jsonb_build_object('cost', v_cost));

    RETURN jsonb_build_object('success', true, 'message', 'Account restored');
END;
$$;
