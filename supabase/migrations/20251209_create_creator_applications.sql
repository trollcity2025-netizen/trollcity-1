-- Create creator_applications table for TrollTract + Empire Partner onboarding
CREATE TABLE creator_applications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Application status and review
    is_trolltract_required boolean DEFAULT true NOT NULL,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')) NOT NULL,
    reviewer_id uuid REFERENCES auth.users(id),
    reviewer_notes text,
    submitted_at timestamptz DEFAULT now() NOT NULL,
    reviewed_at timestamptz,
    
    -- Application details
    category text DEFAULT 'broadcaster' CHECK (category IN ('broadcaster', 'empire_partner')) NOT NULL,
    experience_text text NOT NULL,
    social_links text,
    goals_text text NOT NULL,
    training_passed boolean DEFAULT false,
    
    -- Empire Partner specific
    empire_partner_request boolean DEFAULT false,
    empire_partner_reason text,
    
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX idx_creator_applications_user_id ON creator_applications(user_id);
CREATE INDEX idx_creator_applications_status ON creator_applications(status);
CREATE INDEX idx_creator_applications_category ON creator_applications(category);

-- Enable RLS
ALTER TABLE creator_applications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own applications
CREATE POLICY "Users can view own applications" ON creator_applications
    FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own applications
CREATE POLICY "Users can create own applications" ON creator_applications
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own applications (only if pending)
CREATE POLICY "Users can update own pending applications" ON creator_applications
    FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');

-- Admins can view all applications
CREATE POLICY "Admins can view all applications" ON creator_applications
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('admin', 'officer')
        )
    );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_creator_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_creator_applications_updated_at
    BEFORE UPDATE ON creator_applications
    FOR EACH ROW
    EXECUTE FUNCTION update_creator_applications_updated_at();

-- Create function to get user's latest application
CREATE OR REPLACE FUNCTION get_user_latest_application(p_user_id uuid)
RETURNS creator_applications AS $$
BEGIN
    RETURN (
        SELECT * FROM creator_applications 
        WHERE user_id = p_user_id 
        ORDER BY created_at DESC 
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user has approved TrollTract application
CREATE OR REPLACE FUNCTION user_has_approved_trolltract(p_user_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM creator_applications 
        WHERE user_id = p_user_id 
        AND status = 'approved' 
        AND is_trolltract_required = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
