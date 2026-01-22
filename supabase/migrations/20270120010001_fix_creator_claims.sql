-- Fix Creator Migration Claims Schema

-- Drop old table if exists (renaming/cleaning up)
DROP TABLE IF EXISTS public.creator_applications CASCADE;
DROP TABLE IF EXISTS public.creator_migration_claims CASCADE; -- In case I created it manually or it exists

-- Create correct table
CREATE TABLE public.creator_migration_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    platform_name TEXT NOT NULL,
    platform_user_id TEXT NOT NULL,
    platform_profile_url TEXT,
    proof_screenshot_url TEXT,
    verification_status TEXT DEFAULT 'pending', -- pending, approved, rejected
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES public.user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- RLS
ALTER TABLE public.creator_migration_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own claims" ON public.creator_migration_claims 
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create claims" ON public.creator_migration_claims 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update pending claims" ON public.creator_migration_claims 
    FOR UPDATE USING (auth.uid() = user_id AND verification_status = 'pending');

CREATE POLICY "Admins can manage claims" ON public.creator_migration_claims 
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (role IN ('admin', 'secretary', 'lead_troll_officer') OR is_admin = true))
    );

-- RPC: Approve Claim
CREATE OR REPLACE FUNCTION public.approve_creator_claim(
    p_claim_id UUID,
    p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Check permissions
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = p_admin_id 
        AND (role IN ('admin', 'secretary', 'lead_troll_officer') OR is_admin = true)
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    -- Get applicant ID
    SELECT user_id INTO v_user_id FROM public.creator_migration_claims WHERE id = p_claim_id;
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Claim not found');
    END IF;

    -- Update Claim Status
    UPDATE public.creator_migration_claims
    SET verification_status = 'approved',
        reviewed_by = p_admin_id,
        updated_at = NOW()
    WHERE id = p_claim_id;

    -- Update User Profile (Founder Badge, Boost, Broadcaster)
    UPDATE public.user_profiles
    SET 
        is_broadcaster = true,
        role = 'founder', 
        updated_at = NOW()
    WHERE id = v_user_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- RPC: Reject Claim
CREATE OR REPLACE FUNCTION public.reject_creator_claim(
    p_claim_id UUID,
    p_admin_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check permissions
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = p_admin_id 
        AND (role IN ('admin', 'secretary', 'lead_troll_officer') OR is_admin = true)
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    -- Update Claim Status
    UPDATE public.creator_migration_claims
    SET verification_status = 'rejected',
        rejection_reason = p_reason,
        reviewed_by = p_admin_id,
        updated_at = NOW()
    WHERE id = p_claim_id;

    RETURN jsonb_build_object('success', true);
END;
$$;
