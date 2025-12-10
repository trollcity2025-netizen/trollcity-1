-- Create RPC functions for creator application management

-- Function to submit a creator application
CREATE OR REPLACE FUNCTION submit_creator_application(
    p_experience_text text,
    p_social_links text DEFAULT '',
    p_goals_text text,
    p_empire_partner_request boolean DEFAULT false,
    p_empire_partner_reason text DEFAULT '',
    p_category text DEFAULT 'broadcaster'
) RETURNS creator_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_application creator_applications;
BEGIN
    -- Check if user has TrollTract contract
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND is_contracted = true
    ) THEN
        RAISE EXCEPTION 'TrollTract contract required to submit application';
    END IF;

    -- Check for existing pending application
    IF EXISTS (
        SELECT 1 FROM creator_applications 
        WHERE user_id = auth.uid() 
        AND status = 'pending'
    ) THEN
        RAISE EXCEPTION 'You already have a pending application';
    END IF;

    -- Create new application
    INSERT INTO creator_applications (
        user_id,
        experience_text,
        social_links,
        goals_text,
        empire_partner_request,
        empire_partner_reason,
        category,
        status,
        submitted_at
    ) VALUES (
        auth.uid(),
        p_experience_text,
        p_social_links,
        p_goals_text,
        p_empire_partner_request,
        p_empire_partner_reason,
        p_category,
        'pending',
        now()
    ) RETURNING * INTO v_application;

    RETURN v_application;
END;
$$;

-- Function to get user's application status
CREATE OR REPLACE FUNCTION get_user_application_status()
RETURNS creator_applications
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT * FROM creator_applications 
    WHERE user_id = auth.uid() 
    ORDER BY created_at DESC 
    LIMIT 1;
$$;

-- Function to review and approve/deny application
CREATE OR REPLACE FUNCTION review_creator_application(
    p_application_id uuid,
    p_status text CHECK (p_status IN ('approved', 'denied')),
    p_reviewer_notes text DEFAULT ''
) RETURNS creator_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_application creator_applications;
BEGIN
    -- Check admin permissions
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'officer')
    ) THEN
        RAISE EXCEPTION 'Admin privileges required';
    END IF;

    -- Update application
    UPDATE creator_applications
    SET 
        status = p_status,
        reviewer_id = auth.uid(),
        reviewer_notes = p_reviewer_notes,
        reviewed_at = now()
    WHERE id = p_application_id
    RETURNING * INTO v_application;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Application not found';
    END IF;

    RETURN v_application;
END;
$$;

-- Function to get all applications for admin review
CREATE OR REPLACE FUNCTION get_all_creator_applications()
RETURNS TABLE (
    id uuid,
    user_id uuid,
    is_trolltract_required boolean,
    status text,
    reviewer_id uuid,
    reviewer_notes text,
    submitted_at timestamptz,
    reviewed_at timestamptz,
    category text,
    experience_text text,
    social_links text,
    goals_text text,
    training_passed boolean,
    empire_partner_request boolean,
    empire_partner_reason text,
    created_at timestamptz,
    updated_at timestamptz,
    username text,
    display_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        ca.*,
        p.username,
        p.display_name
    FROM creator_applications ca
    JOIN profiles p ON ca.user_id = p.id
    ORDER BY ca.submitted_at DESC;
$$;

-- Function to check if user can access creator features
CREATE OR REPLACE FUNCTION user_can_access_creator_features(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM creator_applications 
        WHERE user_id = p_user_id 
        AND status = 'approved'
    );
$$;