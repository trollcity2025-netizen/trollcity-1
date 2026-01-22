
-- Add columns for Creator Switch Perks
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS has_founder_badge BOOLEAN DEFAULT false;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS boost_expires_at TIMESTAMPTZ;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS fee_reduction_expires_at TIMESTAMPTZ;

-- RPC to Approve Creator Claim
DROP FUNCTION IF EXISTS public.approve_creator_claim(UUID, UUID);
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
    v_status TEXT;
BEGIN
    -- Check permissions (Admin/Secretary/Lead Officer)
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = p_admin_id 
        AND (role IN ('admin', 'secretary', 'lead_troll_officer') OR is_admin = true)
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    -- Get claim info
    SELECT user_id, verification_status INTO v_user_id, v_status
    FROM public.creator_migration_claims
    WHERE id = p_claim_id;

    IF v_status != 'pending' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Claim is not pending');
    END IF;

    -- Update Claim Status
    UPDATE public.creator_migration_claims
    SET verification_status = 'approved',
        updated_at = NOW()
    WHERE id = p_claim_id;

    -- Update User Profile (Grant Perks)
    UPDATE public.user_profiles
    SET 
        has_founder_badge = true,
        boost_expires_at = NOW() + INTERVAL '7 days',
        fee_reduction_expires_at = NOW() + INTERVAL '30 days',
        updated_at = NOW()
    WHERE id = v_user_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- RPC to Reject Creator Claim
DROP FUNCTION IF EXISTS public.reject_creator_claim;
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
        updated_at = NOW()
    WHERE id = p_claim_id;

    RETURN jsonb_build_object('success', true);
END;
$$;
