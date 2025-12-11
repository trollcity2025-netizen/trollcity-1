-- Create user agreements table for Troll City
-- This table stores digital signatures and acceptance records for the Troll City User Agreement

CREATE TABLE IF NOT EXISTS user_agreements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    email TEXT,
    agreement_version TEXT NOT NULL DEFAULT '1.0',
    terms_accepted BOOLEAN NOT NULL DEFAULT true,
    accepted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    digital_signature TEXT, -- Could store a hash or encrypted signature
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_agreements_user_id ON user_agreements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_agreements_accepted_at ON user_agreements(accepted_at);
CREATE INDEX IF NOT EXISTS idx_user_agreements_terms_accepted ON user_agreements(terms_accepted);
CREATE INDEX IF NOT EXISTS idx_user_agreements_agreement_version ON user_agreements(agreement_version);

-- Create a view for agreement statistics
CREATE OR REPLACE VIEW agreement_stats AS
SELECT
    COUNT(*) as total_agreements,
    COUNT(*) FILTER (WHERE accepted_at >= CURRENT_DATE) as accepted_today,
    COUNT(*) FILTER (WHERE accepted_at >= CURRENT_DATE - INTERVAL '7 days') as accepted_this_week,
    ROUND(
        COUNT(*) FILTER (WHERE terms_accepted = true)::decimal /
        NULLIF(COUNT(*), 0) * 100, 1
    ) as compliance_rate_percent
FROM user_agreements;

-- Enable RLS (Row Level Security)
ALTER TABLE user_agreements ENABLE ROW LEVEL SECURITY;

-- Create policies for user agreements
-- Users can only see their own agreements
CREATE POLICY "Users can view own agreements" ON user_agreements
    FOR SELECT USING (auth.uid() = user_id);

-- Admins can see all agreements
CREATE POLICY "Admins can view all agreements" ON user_agreements
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND (role = 'admin' OR is_admin = true)
        )
    );

-- Function to record agreement acceptance
CREATE OR REPLACE FUNCTION record_agreement_acceptance(
    p_user_id UUID,
    p_agreement_version TEXT DEFAULT '1.0',
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_agreement_id UUID;
    v_username TEXT;
    v_email TEXT;
BEGIN
    -- Get user details
    SELECT username, email INTO v_username, v_email
    FROM user_profiles
    WHERE id = p_user_id;

    IF v_username IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    -- Insert agreement record
    INSERT INTO user_agreements (
        user_id,
        username,
        email,
        agreement_version,
        terms_accepted,
        ip_address,
        user_agent,
        digital_signature
    ) VALUES (
        p_user_id,
        v_username,
        v_email,
        p_agreement_version,
        true,
        p_ip_address,
        p_user_agent,
        encode(digest(p_user_id::text || p_agreement_version || NOW()::text, 'sha256'), 'hex')
    ) RETURNING id INTO v_agreement_id;

    -- Update user profile to mark terms as accepted
    UPDATE user_profiles
    SET terms_accepted = true,
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN v_agreement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has accepted current agreement version
CREATE OR REPLACE FUNCTION has_accepted_agreement(
    p_user_id UUID,
    p_agreement_version TEXT DEFAULT '1.0'
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_agreements
        WHERE user_id = p_user_id
        AND agreement_version = p_agreement_version
        AND terms_accepted = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_agreements_updated_at
    BEFORE UPDATE ON user_agreements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT SELECT ON user_agreements TO authenticated;
GRANT SELECT ON agreement_stats TO authenticated;
GRANT ALL ON user_agreements TO service_role;

-- Comments for documentation
COMMENT ON TABLE user_agreements IS 'Stores user agreement acceptances and digital signatures for Troll City';
COMMENT ON COLUMN user_agreements.digital_signature IS 'SHA256 hash of user_id + agreement_version + timestamp for verification';
COMMENT ON COLUMN user_agreements.ip_address IS 'IP address of the user when accepting the agreement';
COMMENT ON COLUMN user_agreements.user_agent IS 'Browser/device information when accepting the agreement';
COMMENT ON VIEW agreement_stats IS 'Statistics view for agreement compliance and acceptance metrics';